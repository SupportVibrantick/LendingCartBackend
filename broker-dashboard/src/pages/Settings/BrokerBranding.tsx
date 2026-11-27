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
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { getBrokerAuthHeaders } from "../../lib/brokerApi";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import { patchBrokerSessionUser } from "../../lib/brokerSession";
import {
  getBrandingCatchMessage,
  readBrandingApiResponse,
} from "../../lib/brandingApiErrors";
import {
  DEFAULT_BROKER_LOGO,
  emitBrokerBrandingUpdated,
} from "../../lib/brokerBranding";

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
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium ${
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-white text-text-secondary"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-slate-300" />
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
    <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-text-secondary/80">{hint}</p>
        ) : null}
        <p
          className={`mt-1 break-all text-text-primary ${
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
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/5"
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
              ? "bg-[#4C78F5] text-white"
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
      emitBrokerBrandingUpdated(
        {
          logoUrl: next.logoUrl || DEFAULT_BROKER_LOGO,
          brandName: next.brandName || null,
          portalLabel: isLoanOfficerPortal ? "Loan Officer" : "Broker Suite",
        },
        isLoanOfficerPortal ? "loan-officer" : "broker",
      );
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
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4C78F5]" />
          <p className="mt-3 text-sm text-text-secondary">
            Loading branding settings…
          </p>
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

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4C78F5]">
              <Palette className="h-3 w-3" />
              Fee agreement branding
            </div>
            <h1 className="ds-page-title">Branding</h1>
            <p className="ds-page-subtitle max-w-3xl">
              {readOnly
                ? "View your company branding used on fee agreements. Contact your broker admin to request changes."
                : "Set your company name and logo once. New fee agreements use this branding automatically; signed agreements keep the identity active at signing."}
            </p>
          </div>
          <nav className="shrink-0 text-[12px] text-text-secondary">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link to="/" className="hover:text-[#4C78F5]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-text-primary">Branding</li>
            </ol>
          </nav>
        </div>

        {readOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            View-only access — branding updates are disabled.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                Setup progress
              </p>
            </div>
            <div className="grid gap-2.5 p-4 sm:grid-cols-3 sm:px-5">
              <RequirementItem done={hasLogo} label="Company logo uploaded" />
              <RequirementItem done={hasBrandName} label="Company name added" />
              <RequirementItem
                done={domainStatus.domainVerified}
                label="Custom domain verified (optional)"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Form */}
          <div className="space-y-4 lg:col-span-3">
            {/* Logo upload */}
            <section className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Company logo
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">
                    Appears at the top of every fee agreement document.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    hasLogo
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                  }`}
                >
                  {hasLogo ? "Added" : "Required"}
                </span>
              </div>

              <div className="p-4 sm:p-5">
              <label
                className={`group relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-7 transition ${
                  readOnly ? "cursor-default" : "cursor-pointer"
                } ${
                  hasLogo
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-border bg-white hover:border-[#4C78F5]/40 hover:bg-[#4C78F5]/[0.03]"
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
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-28 w-56 items-center justify-center rounded-xl border border-border bg-white p-4">
                      <img
                        src={form.logoUrl}
                        alt="Broker logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-sm font-medium text-text-secondary">
                      {readOnly ? "Company logo" : "Click to replace logo"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        Drag & drop or click to upload
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        PNG, JPG, WEBP or SVG · Max 2MB
                      </p>
                    </div>
                  </div>
                )}
              </label>

              {hasLogo && canManageBranding ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-sm font-medium text-rose-600 hover:text-rose-700"
                  >
                    Remove logo
                  </button>
                </div>
              ) : null}
              </div>
            </section>

            {/* Company name */}
            <section className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Company name
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">
                    Used on fee agreements, documents, and your broker profile.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    hasBrandName
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                  }`}
                >
                  {hasBrandName ? "Added" : "Required"}
                </span>
              </div>

              <div className="p-4 sm:p-5">
              <input
                className={`h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-text-primary outline-none transition focus:ring-2 ${
                  hasBrandName
                    ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                    : "border-border focus:border-[#4C78F5]/50 focus:ring-[#4C78F5]/15"
                } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
                value={form.brandName}
                readOnly={readOnly}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="e.g. Acme Lending Group"
              />
              </div>
            </section>

            {/* Custom domain */}
            <section className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                        <Globe className="h-4 w-4" />
                      </span>
                      Custom domain
                    </h2>
                    <p className="mt-1.5 text-[13px] text-text-secondary">
                      Optional hostname for client share links and team portals.
                      Platform URLs keep working until verified.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                      domainStatus.domainVerified
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        : saved.customDomain
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-slate-50 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {domainStatus.domainVerified
                      ? "Verified"
                      : saved.customDomain
                        ? "Pending DNS"
                        : "Not set"}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row sm:items-center">
                  <DomainStep
                    step={1}
                    title="Enter domain"
                    done={Boolean(saved.customDomain)}
                    active={!saved.customDomain}
                  />
                  <div className="hidden h-px flex-1 bg-border sm:block" />
                  <DomainStep
                    step={2}
                    title="Add DNS"
                    done={domainStatus.domainVerified}
                    active={Boolean(saved.customDomain) && !domainStatus.domainVerified}
                  />
                  <div className="hidden h-px flex-1 bg-border sm:block" />
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

              <div className="space-y-4 p-4 sm:p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary">
                    Hostname
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                      https://
                    </span>
                    <input
                      className={`h-10 w-full rounded-xl border bg-white py-2 pl-[4.5rem] pr-4 text-sm text-text-primary outline-none transition focus:ring-2 ${
                        domainStatus.domainVerified
                          ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                          : "border-border focus:border-[#4C78F5]/50 focus:ring-[#4C78F5]/15"
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
                  <p className="mt-2 text-xs text-text-secondary">
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
                      className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-xs font-medium text-text-secondary"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#4C78F5]" />
                      {label}
                    </div>
                  ))}
                </div>

                {domainStatus.domainVerified && domainStatus.publicBaseUrl ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800">
                        Domain is live
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-emerald-700">
                        {domainStatus.publicBaseUrl}
                      </p>
                    </div>
                    <a
                      href={domainStatus.publicBaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </div>
                ) : null}

                {domainStatus.dnsInstructions && saved.customDomain && !domainStatus.domainVerified ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-white">
                    <div className="border-b border-border bg-slate-50/70 px-4 py-3.5 sm:px-5">
                      <p className="text-sm font-semibold text-text-primary">
                        How to connect your domain
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        This proves you own{" "}
                        <span className="font-semibold text-text-primary">
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
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-bold text-white">
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
                                  <span className="rounded-md bg-[#4C78F5] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
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
                          : "bg-[#4C78F5] text-white hover:bg-[#0f426d]"
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
            <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    How branding works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[13px] text-text-secondary">
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
            <div className="sticky top-20 space-y-3">
              <div className="overflow-hidden rounded-2xl border border-border bg-white">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
                  <FileText className="h-4 w-4 text-[#4C78F5]" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Fee agreement preview
                  </h3>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="overflow-hidden rounded-xl border border-border bg-white">
                    <div className="border-b border-border bg-slate-50/70 px-4 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
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
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border bg-white text-text-secondary">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          FINDER & FINANCIAL AGREEMENT
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {hasBrandName
                            ? form.brandName.trim()
                            : "Your company name"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-dashed border-border bg-slate-50/50 px-3 py-3.5 text-left text-[11px] leading-relaxed text-text-secondary">
                        This preview shows how your logo and company name will
                        appear at the top of client-facing fee agreements.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!isFormComplete ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  Upload a logo and enter your company name to enable saving.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Save bar */}
        {canManageBranding ? (
          <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-white p-3.5 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-text-secondary">
                {canSave ? (
                  <span className="font-medium text-emerald-600">
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
                className="ds-btn-primary min-w-[160px] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save branding
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
