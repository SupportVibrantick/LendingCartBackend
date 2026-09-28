import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import LoanApplication from "../pages/LoanApplication/LoanApplication";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type ResolvedLink = {
  brokerOrgId: string;
  sourcePortal: "BROKER" | "LOAN_OFFICER" | "CO_BROKER" | "LEGACY";
  showCoBrokerBorrowerInformationTab: boolean;
  ref: string | null;
  loanCategories: string[];
  loanTypes: string[];
  packageCode: string | null;
  feeAgreementEnabled: boolean;
};

async function fetchEntitlementsForOrg(
  brokerOrgId: string,
  ref?: string | null,
): Promise<
  Pick<
    ResolvedLink,
    "loanCategories" | "loanTypes" | "packageCode" | "feeAgreementEnabled"
  >
> {
  try {
    const qs = ref
      ? `ref=${encodeURIComponent(ref)}`
      : `brokerOrgId=${encodeURIComponent(brokerOrgId)}`;
    const res = await fetch(
      `${API_BASE}/api/public/broker/applications/entitlements?${qs}`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return {
        loanCategories: [],
        loanTypes: [],
        packageCode: null,
        feeAgreementEnabled: false,
      };
    }
    return {
      loanCategories: json.data?.loanCategories || [],
      loanTypes: json.data?.loanTypes || [],
      packageCode: json.data?.packageCode || null,
      feeAgreementEnabled: Boolean(json.data?.feeAgreementEnabled),
    };
  } catch {
    return {
      loanCategories: [],
      loanTypes: [],
      packageCode: null,
      feeAgreementEnabled: false,
    };
  }
}

export default function GetLoanPage() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedLink | null>(null);

  const refParam = useMemo(
    () => searchParams.get("ref")?.trim() || null,
    [searchParams],
  );
  const brokerParam = useMemo(
    () =>
      searchParams.get("broker")?.trim() ||
      searchParams.get("brokerOrgId")?.trim() ||
      null,
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setResolving(true);
      setResolveError(null);

      try {
        if (refParam) {
          const res = await fetch(
            `${API_BASE}/api/public/broker/applications/link?ref=${encodeURIComponent(refParam)}`,
          );
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.success) {
            throw new Error(
              json?.message || "This application link is invalid or expired",
            );
          }

          const brokerOrgId =
            json.data.brokerOrganizationId || json.data.brokerOrgId;

          // Always load entitlements from the dedicated endpoint so plan
          // filters work even if /link was served from a stale process.
          const entitlements = await fetchEntitlementsForOrg(
            brokerOrgId,
            refParam,
          );

          if (cancelled) return;
          setResolved({
            brokerOrgId,
            sourcePortal: json.data.sourcePortal,
            showCoBrokerBorrowerInformationTab: Boolean(
              json.data.showCoBrokerBorrowerInformationTab,
            ),
            ref: refParam,
            loanCategories:
              entitlements.loanCategories.length > 0
                ? entitlements.loanCategories
                : json.data.loanCategories || [],
            loanTypes:
              entitlements.loanTypes.length > 0
                ? entitlements.loanTypes
                : json.data.loanTypes || [],
            packageCode:
              entitlements.packageCode || json.data.packageCode || null,
            feeAgreementEnabled:
              entitlements.feeAgreementEnabled ||
              Boolean(json.data.feeAgreementEnabled),
          });
          return;
        }

        if (brokerParam) {
          const entitlements = await fetchEntitlementsForOrg(brokerParam);
          if (cancelled) return;
          setResolved({
            brokerOrgId: brokerParam,
            sourcePortal: "LEGACY",
            showCoBrokerBorrowerInformationTab: false,
            ref: null,
            ...entitlements,
          });
          return;
        }

        if (!cancelled) {
          setResolved(null);
          setResolveError(
            "This page requires a valid broker link. Please use the link your broker sent you.",
          );
        }
      } catch (err) {
        if (!cancelled) {
          setResolved(null);
          setResolveError(
            err instanceof Error ? err.message : "Failed to load application link",
          );
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refParam, brokerParam]);

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Application Submitted
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your loan application has been received. A broker will
            review it and contact you with next steps.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-6 rounded-lg bg-[#2C92D5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19679b]"
          >
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading application form...
        </div>
      </div>
    );
  }

  if (!resolved?.brokerOrgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Invalid Application Link
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {resolveError ||
              "This page requires a valid broker link. Please use the link your broker sent you, or contact them for a new one."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <LoanApplication
          embedded
          publicEmbed
          brokerOrgId={resolved.brokerOrgId}
          publicLinkRef={resolved.ref}
          publicSourcePortal={
            (resolved.sourcePortal?.toLowerCase() as any) || null
          }
          showCoBrokerBorrowerInformationTab={
            resolved.showCoBrokerBorrowerInformationTab
          }
          allowedLoanCategories={resolved.loanCategories}
          allowedLoanTypes={resolved.loanTypes}
          feeAgreementEnabled={resolved.feeAgreementEnabled}
          onPublicSubmitSuccess={() => setSubmitted(true)}
        />
      </div>
    </div>
  );
}
