import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Globe2,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";
import {
  formatCompactAmount,
  formatLoanProduct,
} from "../../lib/loanPipelineUtils";
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

function hasValue(value?: string | number | null) {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-medium italic text-text-secondary/70">
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  emptyLabel = "Not configured",
}: {
  label: string;
  value?: string | number | null;
  emptyLabel?: string;
}) {
  const filled = hasValue(value);

  return (
    <div className="rounded-xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
        {label}
      </p>
      {filled ? (
        <p className="mt-1 truncate text-xl font-bold tabular-nums leading-none text-text-primary dark:text-white">
          {value}
        </p>
      ) : (
        <p className="mt-1">
          <EmptyHint>{emptyLabel}</EmptyHint>
        </p>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  emptyLabel = "Not provided",
}: {
  icon: ReactNode;
  label: string;
  value?: string | number | null;
  emptyLabel?: string;
}) {
  const filled = hasValue(value);

  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </p>
        {filled ? (
          <p className="mt-0.5 break-words text-sm font-medium text-text-primary dark:text-white">
            {value}
          </p>
        ) : (
          <p className="mt-0.5">
            <EmptyHint>{emptyLabel}</EmptyHint>
          </p>
        )}
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

// Share one in-flight /me call across React Strict Mode remounts.
let inflightProfileOverview: Promise<any> | null = null;

function fetchProfileOverview() {
  if (!inflightProfileOverview) {
    inflightProfileOverview = fetch(
      `${API_BASE}/lender/auth/me?includeProductSummary=true`,
      { headers: getLenderAuthHeaders() },
    )
      .then(async (res) => {
        const json = await res.json();
        return { res, json };
      })
      .finally(() => {
        inflightProfileOverview = null;
      });
  }

  return inflightProfileOverview;
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
    const minRates = rates
      .map((rate) => Number(rate.min))
      .filter((n) => Number.isFinite(n));
    const maxRates = rates
      .map((rate) => Number(rate.max))
      .filter((n) => Number.isFinite(n));

    return {
      minLoan: minLoanValues.length ? Math.min(...minLoanValues) : null,
      maxLoan: maxLoanValues.length ? Math.max(...maxLoanValues) : null,
      minCredit: creditScores.length ? Math.min(...creditScores) : null,
      minDscr: dscrValues.length ? Math.min(...dscrValues) : null,
      minRate: minRates.length ? Math.min(...minRates) : null,
      maxRate: maxRates.length ? Math.max(...maxRates) : null,
      programCount: active.length,
    };
  }, [loanProducts]);

  const loadProfile = useCallback(async (isActive?: () => boolean) => {
    try {
      setLoading(true);

      const { res: profileRes, json: profileJson } =
        await fetchProfileOverview();

      if (isActive && !isActive()) return;

      if (!profileRes.ok || profileJson.ok !== true) {
        throw new Error("Failed to load profile");
      }

      const { user, lenderProfile, organization, loanProducts: products } =
        profileJson.data;

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
      setLoanProducts(Array.isArray(products) ? products : []);
    } catch (error: any) {
      if (isActive && !isActive()) return;
      toast.error(error.message || "Unable to load profile");
    } finally {
      if (!isActive || isActive()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadProfile(() => active);
    return () => {
      active = false;
    };
  }, [loadProfile, location.key]);

  const displayMinLoan = productSummary?.minLoan ?? minFunding ?? null;
  const displayMaxLoan = productSummary?.maxLoan ?? maxFunding ?? null;

  const supportedStates = useMemo(() => {
    if (!statesSupported?.trim()) return [];

    return [
      ...new Set(
        statesSupported
          .split(/[,|/\n]+/)
          .map((state) => state.trim().toUpperCase())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [statesSupported]);

  const rateRangeLabel =
    productSummary?.minRate != null && productSummary?.maxRate != null
      ? `${productSummary.minRate}% – ${productSummary.maxRate}%`
      : productSummary?.minRate != null
        ? `From ${productSummary.minRate}%`
        : productSummary?.maxRate != null
          ? `Up to ${productSummary.maxRate}%`
          : null;

  const initials = (orgName || "L")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-text-secondary">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
        <p className="text-xs">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-text-primary dark:text-slate-100">
        {/* Header */}
        <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold tracking-wide text-white">
                {initials || "L"}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  Lender profile
                </p>
                <h1 className="ds-page-title mt-0.5 truncate !text-[22px]">
                  {orgName}
                </h1>
                <p className="mt-0.5 truncate text-[13px] text-text-secondary">
                  {hasValue(contactEmail) ? (
                    contactEmail
                  ) : (
                    <EmptyHint>Email not provided</EmptyHint>
                  )}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      profileComplete
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {profileComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CircleAlert className="h-3.5 w-3.5" />
                    )}
                    {profileComplete ? "Profile complete" : "Profile incomplete"}
                  </span>
                  {productSummary ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600">
                      <Layers className="h-3.5 w-3.5" />
                      {productSummary.programCount} active program
                      {productSummary.programCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                      <Layers className="h-3.5 w-3.5" />
                      No programs configured
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canManageProfile ? (
              <Link
                to="/profile/edit"
                className="ds-btn-primary shrink-0 self-start lg:self-center"
              >
                <Pencil size={16} />
                {profileComplete ? "Edit full profile" : "Complete full profile"}
              </Link>
            ) : null}
          </div>

          {!profileComplete && completionGaps.length > 0 && canManageProfile ? (
            <div className="border-t border-amber-100 bg-amber-50/70 px-4 py-3.5 sm:px-5 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Finish these items to appear in the broker marketplace
              </p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {completionGaps.map((gap) => (
                  <li
                    key={gap}
                    className="flex items-start gap-2 text-[13px] text-amber-800 dark:text-amber-200/90"
                  >
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Lending snapshot */}
        <section className="space-y-2.5">
          <div>
            <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
              Lending snapshot
            </h2>
            <p className="text-[13px] text-text-secondary">
              Aggregated from your active loan programs
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Min loan"
              value={
                displayMinLoan ? formatCompactAmount(displayMinLoan) : null
              }
              emptyLabel="Not set"
            />
            <StatTile
              label="Max loan"
              value={
                displayMaxLoan ? formatCompactAmount(displayMaxLoan) : null
              }
              emptyLabel="Not set"
            />
            <StatTile
              label="Min credit"
              value={productSummary?.minCredit ?? null}
              emptyLabel="Not set"
            />
            <StatTile
              label="Min DSCR"
              value={productSummary?.minDscr ?? null}
              emptyLabel="Not set"
            />
            <StatTile
              label="Rate range"
              value={rateRangeLabel}
              emptyLabel="Not set"
            />
            <StatTile
              label="Programs"
              value={productSummary?.programCount ?? null}
              emptyLabel="None yet"
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Company & contact */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary dark:text-white">
                  Company & contact
                </h2>
                <p className="text-[12px] text-text-secondary">
                  How brokers reach your organization
                </p>
              </div>
            </div>

            <div className="divide-y divide-border px-4 sm:px-5 dark:divide-slate-800">
              <DetailRow
                icon={<Building2 className="h-4 w-4" />}
                label="Company name"
                value={orgName}
              />
              <DetailRow
                icon={<UserRound className="h-4 w-4" />}
                label="Contact name"
                value={contactName}
                emptyLabel="Add a contact name"
              />
              <DetailRow
                icon={<Mail className="h-4 w-4" />}
                label="Contact email"
                value={contactEmail}
                emptyLabel="Add a contact email"
              />
              <DetailRow
                icon={<Phone className="h-4 w-4" />}
                label="Contact phone"
                value={contactPhone}
                emptyLabel="Add a phone number"
              />
              <DetailRow
                icon={<Globe2 className="h-4 w-4" />}
                label="Website"
                value={website}
                emptyLabel="Add a website"
              />
            </div>
          </section>

          {/* About */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
              <h2 className="text-[15px] font-semibold text-text-primary dark:text-white">
                About your lending
              </h2>
              <p className="text-[12px] text-text-secondary">
                Marketplace summary shown to brokers
              </p>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              {summary?.trim() ? (
                <div className="rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-text-primary dark:border-slate-700 dark:bg-slate-950">
                  {summary}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-7 text-center dark:border-slate-700">
                  <p className="text-sm font-medium text-text-primary">
                    No lending summary yet
                  </p>
                  <p className="mt-1 text-[13px] text-text-secondary">
                    Add a short overview so brokers understand your focus.
                  </p>
                  {canManageProfile ? (
                    <Link
                      to="/profile/edit"
                      className="mt-3 inline-flex text-sm font-semibold text-brand-500 hover:underline"
                    >
                      Add summary
                    </Link>
                  ) : null}
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  Loan types
                </p>
                {loanTypes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {loanTypes.map((type) => (
                      <span
                        key={type}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600"
                      >
                        {formatLoanProduct(type)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2">
                    <EmptyHint>No loan types listed</EmptyHint>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    States supported
                  </p>
                  {supportedStates.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                      <MapPin className="h-3 w-3 text-brand-500" />
                      {supportedStates.length}{" "}
                      {supportedStates.length === 1 ? "state" : "states"}
                    </span>
                  ) : null}
                </div>
                {supportedStates.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {supportedStates.map((state) => (
                      <span
                        key={state}
                        className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold tracking-wide text-text-primary dark:border-slate-700 dark:bg-slate-950"
                      >
                        {state}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2">
                    <EmptyHint>No states listed</EmptyHint>
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {!canManageProfile ? (
          <p className="text-[13px] text-text-secondary">
            Read-only profile view. Contact your lender admin to make changes.
          </p>
        ) : null}
    </div>
  );
}
