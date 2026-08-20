import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { Loader2, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";
import { formatCompactAmount } from "../../lib/loanPipelineUtils";
import { canManageLenderProfile } from "../../lib/lenderPermissions";
import {
  getProfileCompletionGaps,
  isLenderProfileComplete,
} from "../../lib/profileCompletion";

type LoanProductRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  minLoanAmount?: number | null;
  maxLoanAmount?: number | null;
  minCreditScore?: number | null;
  minDscr?: number | null;
  interestRateRange?: string | null;
  isActive?: boolean;
};

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {value !== null && value !== undefined && String(value).trim()
          ? value
          : "—"}
      </div>
    </div>
  );
}

function parseRateRange(value?: string | null) {
  if (!value) return { min: "", max: "" };
  const cleaned = String(value).replace("%", "");
  const [min, max] = cleaned.split("-");
  return { min: min?.trim() || "", max: max?.trim() || "" };
}

export default function LenderProfileView() {
  const location = useLocation();
  const canManageProfile = canManageLenderProfile();
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [profileStatus, setProfileStatus] = useState("INCOMPLETE");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [website, setWebsite] = useState("");
  const [minFunding, setMinFunding] = useState<number | null>(null);
  const [maxFunding, setMaxFunding] = useState<number | null>(null);
  const [loanTypes, setLoanTypes] = useState<string[]>([]);
  const [statesSupported, setStatesSupported] = useState("");
  const [loanProducts, setLoanProducts] = useState<LoanProductRow[]>([]);

  const profileComplete = isLenderProfileComplete(profileStatus);

  const completionGaps = useMemo(
    () =>
      getProfileCompletionGaps({
        summary,
        loanTypes,
        minFunding,
        maxFunding,
        statesSupported,
        profileStatus,
      }),
    [
      summary,
      loanTypes,
      minFunding,
      maxFunding,
      statesSupported,
      profileStatus,
    ],
  );

  const productSummary = useMemo(() => {
    const active = loanProducts.filter((product) => product.isActive !== false);
    if (!active.length) return null;

    const minLoanValues = active
      .map((product) => product.minLoanAmount)
      .filter((value): value is number => typeof value === "number");
    const maxLoanValues = active
      .map((product) => product.maxLoanAmount)
      .filter((value): value is number => typeof value === "number");
    const creditScores = active
      .map((product) => product.minCreditScore)
      .filter((value): value is number => typeof value === "number");
    const dscrValues = active
      .map((product) => product.minDscr)
      .filter((value): value is number => typeof value === "number");

    const rates = active.map((product) =>
      parseRateRange(product.interestRateRange),
    );

    return {
      minLoan: minLoanValues.length ? Math.min(...minLoanValues) : null,
      maxLoan: maxLoanValues.length ? Math.max(...maxLoanValues) : null,
      minCredit: creditScores.length ? Math.min(...creditScores) : null,
      minDscr: dscrValues.length ? Math.min(...dscrValues) : null,
      minRate: rates.find((rate) => rate.min)?.min || "",
      maxRate: rates.find((rate) => rate.max)?.max || "",
      programCount: active.length,
    };
  }, [loanProducts]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const [profileRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/lender/auth/me`, {
          headers: getLenderAuthHeaders(),
        }),
        fetch(`${API_BASE}/lender/loan-products/list?limit=100`, {
          headers: getLenderAuthHeaders(),
        }),
      ]);

      const profileJson = await profileRes.json();
      const productsJson = await productsRes.json();

      if (!profileRes.ok || profileJson.ok !== true) {
        throw new Error("Failed to load profile");
      }

      const { user, lenderProfile, organization } = profileJson.data;

      setOrgName(organization?.name || "Lender");
      setProfileStatus(lenderProfile?.profileStatus || "INCOMPLETE");
      setContactName(`${user.firstName || ""} ${user.lastName || ""}`.trim());
      setContactEmail(organization?.email || user.email || "");
      setContactPhone(organization?.phone || "");
      setSummary(lenderProfile?.summary || "");
      setWebsite(lenderProfile?.website || "");
      setMinFunding(
        lenderProfile?.minFunding ? Number(lenderProfile.minFunding) : null,
      );
      setMaxFunding(
        lenderProfile?.maxFunding ? Number(lenderProfile.maxFunding) : null,
      );
      setLoanTypes(
        Array.isArray(lenderProfile?.loanTypes) ? lenderProfile.loanTypes : [],
      );
      setStatesSupported(lenderProfile?.statesSupported || "");

      if (productsRes.ok && productsJson.success) {
        setLoanProducts(productsJson.data || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, location.key]);

  const displayMinLoan = productSummary?.minLoan ?? minFunding ?? null;
  const displayMaxLoan = productSummary?.maxLoan ?? maxFunding ?? null;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#183b57]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lender Portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            My Profile
          </h1>
          {!profileComplete && canManageProfile && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Complete your full profile to appear in the broker marketplace.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              profileComplete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {profileComplete ? "Profile Complete" : "Profile Incomplete"}
          </span>
          {canManageProfile && (
            <Link
              to="/profile/edit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#183b57] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264863]"
            >
              <Pencil size={16} />
              {profileComplete ? "Edit Full Profile" : "Complete Full Profile"}
            </Link>
          )}
        </div>
      </div>

      {!profileComplete && completionGaps.length > 0 && canManageProfile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            To mark your profile complete:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">
            {completionGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#183b57] to-[#183b57] px-6 py-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-white">{orgName}</h2>
          <p className="mt-1 text-sm text-brand-100">{contactEmail}</p>
          {productSummary && (
            <p className="mt-2 text-xs text-brand-100/90">
              {productSummary.programCount} active loan program
              {productSummary.programCount === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <ReadOnlyField label="Company Name" value={orgName} />
          <ReadOnlyField label="Contact Name" value={contactName} />
          <ReadOnlyField label="Contact Email" value={contactEmail} />
          <ReadOnlyField label="Contact Phone" value={contactPhone} />
          <ReadOnlyField label="Website" value={website} />
          <ReadOnlyField
            label="Min Loan Amount"
            value={
              displayMinLoan ? formatCompactAmount(displayMinLoan) : undefined
            }
          />
          <ReadOnlyField
            label="Max Loan Amount"
            value={
              displayMaxLoan ? formatCompactAmount(displayMaxLoan) : undefined
            }
          />
          <ReadOnlyField
            label="Min Credit Score"
            value={productSummary?.minCredit ?? undefined}
          />
          <ReadOnlyField
            label="Min DSCR"
            value={productSummary?.minDscr ?? undefined}
          />
          <ReadOnlyField
            label="Rate Min %"
            value={productSummary?.minRate || undefined}
          />
          <ReadOnlyField
            label="Rate Max %"
            value={productSummary?.maxRate || undefined}
          />
          <div className="md:col-span-2">
            <ReadOnlyField label="Notes" value={summary} />
          </div>
        </div>
      </div>

      {!canManageProfile && (
        <p className="text-sm text-slate-500">
          Read-only profile view. Contact your lender admin to make changes.
        </p>
      )}
    </div>
  );
}
