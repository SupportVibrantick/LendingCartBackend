import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  DollarSign,
  FileText,
  Globe,
  Handshake,
  Layers,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";
import {
  fetchEligibleLendersForSubmission,
  fetchLenderProducts,
  fetchLenderProfile,
  fetchRecentPipelineSubmissions,
  formatCompactMoney,
  formatCurrency,
  formatDisplayPhone,
  formatFundingTime,
  formatLenderType,
  formatLoanAmountRange,
  formatLoanTypeLabel,
  formatStatesSummary,
  getLenderDisplayName,
  mergeDiscoverProfile,
  parseDelimitedList,
  parseStatesList,
  resolveLenderLogoUrl,
  sendSubmissionToLenders,
  abbreviateStateCode,
  type ConnectedLender,
  type DiscoverLender,
  type EligibleLenderMatch,
  type LenderFullProfile,
  type LenderProduct,
  type LenderProfileProduct,
  type PipelineSubmissionOption,
} from "../../lib/lenderMarketplaceApi";

const BRAND = "#2C92D5";

type ModalShellProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  extraWide?: boolean;
};

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  extraWide,
}: ModalShellProps) {
  const maxWidth = extraWide ? "max-w-4xl" : wide ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col min-h-0`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 p-5">{children}</div>
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function LenderProductsModal({
  lender,
  onClose,
}: {
  lender: ConnectedLender;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<LenderProduct[]>([]);
  const [profile, setProfile] = useState<LenderFullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [productData, profileData] = await Promise.all([
          fetchLenderProducts(lender.lenderId),
          fetchLenderProfile(lender.lenderId).catch(() => null),
        ]);
        if (!cancelled) {
          setProducts(productData);
          setProfile(profileData);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load products");
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lender.lenderId]);

  const activeProducts = products.filter((p) => p.isActive);
  const displayName = getLenderDisplayName(
    lender.lenderName,
    profile?.brandName,
  );

  const fundingSummary = activeProducts.reduce(
    (acc, p) => {
      const min = Number(p.minLoanAmount);
      const max = Number(p.maxLoanAmount);
      if (Number.isFinite(min) && min > 0) {
        acc.min = acc.min === null ? min : Math.min(acc.min, min);
      }
      if (Number.isFinite(max) && max > 0) {
        acc.max = acc.max === null ? max : Math.max(acc.max, max);
      }
      return acc;
    },
    { min: null as number | null, max: null as number | null },
  );

  const productsFooter = !loading && (
    <button
      type="button"
      onClick={onClose}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      Close
    </button>
  );

  return (
    <ModalShell
      title="Lender Products"
      subtitle={displayName}
      onClose={onClose}
      wide
      extraWide
      footer={productsFooter}
    >
      {loading ? (
        <ProductsModalSkeleton />
      ) : activeProducts.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Layers size={24} className="text-slate-400" />
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            No active products
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {displayName} has not published any active loan programs yet.
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {/* Lender header */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-blue-500/5 p-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <LenderLogo
                brandLogoUrl={profile?.brandLogoUrl}
                profileImage={profile?.profileImage}
                alt={`${displayName} logo`}
                className="h-14 w-14"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Connected lender
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {displayName}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeProducts.length} active program
                  {activeProducts.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ProductSummaryStat
                icon={<Layers size={14} />}
                label="Programs"
                value={String(activeProducts.length)}
              />
              <ProductSummaryStat
                icon={<DollarSign size={14} />}
                label="Min loan"
                value={
                  fundingSummary.min !== null
                    ? formatCompactMoney(fundingSummary.min)
                    : "—"
                }
              />
              <ProductSummaryStat
                icon={<DollarSign size={14} />}
                label="Max loan"
                value={
                  fundingSummary.max !== null
                    ? formatCompactMoney(fundingSummary.max)
                    : "—"
                }
              />
            </div>
          </div>

          {/* Product list */}
          <div className="space-y-3">
            {activeProducts.map((p, index) => (
              <ProductCard key={p.lenderProductId} product={p} index={index} />
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function ProductSummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function ProductCard({ product, index }: { product: LenderProduct; index: number }) {
  const regions = parseStatesList(product.regionsSupported);
  const industries = parseDelimitedList(product.industriesSupported);
  const codeLabel = formatLoanTypeLabel(product.loanProductCode);

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900/50 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors">
      <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: BRAND }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-white leading-snug">
                {product.loanProductName}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">{codeLabel}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {product.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ProductMetric
            icon={<DollarSign size={14} />}
            label="Loan amount"
            value={`${formatCompactMoney(product.minLoanAmount)} – ${formatCompactMoney(product.maxLoanAmount)}`}
          />
          <ProductMetric
            icon={<Calendar size={14} />}
            label="Term"
            value={product.termRange || "Not specified"}
          />
        </div>

        {regions.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
              <MapPin size={12} />
              States supported ({regions.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {regions.map((st) => (
                <span
                  key={st}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20"
                >
                  {st}
                </span>
              ))}
            </div>
          </div>
        )}

        {industries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Industries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ProductMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 break-words">
        {value}
      </p>
    </div>
  );
}

function ProductsModalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function StarRating({ count = 5 }: { count?: number }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-400 text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function LenderLogo({
  brandLogoUrl,
  profileImage,
  alt,
  name,
  className = "h-20 w-20",
}: {
  brandLogoUrl?: string | null;
  profileImage?: string | null;
  alt: string;
  name?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveLenderLogoUrl({ brandLogoUrl, profileImage });
  const initials = name?.trim()
    ? name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "?"
    : null;

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-slate-100 dark:from-blue-500/10 dark:to-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm`}
        aria-label={alt}
      >
        {initials ? (
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">
            {initials}
          </span>
        ) : (
          <Building2 className="h-7 w-7 text-slate-400" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm p-2`}
    >
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function LenderDiscoverProfileModal({
  lender,
  onClose,
  onInvite,
  inviting,
}: {
  lender: DiscoverLender;
  onClose: () => void;
  onInvite: () => void;
  inviting?: boolean;
}) {
  const [detail, setDetail] = useState<LenderFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const data = await fetchLenderProfile(lender.id);
        if (!cancelled) setDetail(data);
      } catch (err: any) {
        if (!cancelled) {
          setLoadFailed(true);
          setDetail(null);
          toast.error(err.message || "Failed to load full profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lender.id]);

  const profile = useMemo(
    () => mergeDiscoverProfile(detail, lender),
    [detail, lender],
  );

  const states = useMemo(
    () => parseStatesList(profile.statesSupported),
    [profile.statesSupported],
  );
  const stateSummary = useMemo(
    () => formatStatesSummary(states),
    [states],
  );
  const industries = useMemo(
    () => parseDelimitedList(profile.industries),
    [profile.industries],
  );
  const products = detail?.products ?? [];
  const fallbackLoanTypes = (profile.loanTypes || []).map(formatLoanTypeLabel);
  const isEligible =
    profile.profileStatus === "COMPLETED" || lender.isEligible;
  const displayName = getLenderDisplayName(
    detail?.name || lender.name,
    detail?.brandName || lender.brandName,
  );
  const formattedPhone = formatDisplayPhone(detail?.phone || lender.phone);

  const locationLine = [
    profile.address,
    profile.city,
    profile.state,
    profile.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const criteriaBlocks = [
    { label: "Lending Criteria", value: profile.lendingCriteria },
    { label: "Guidelines", value: profile.lendingGuidelines },
    { label: "Credit Requirements", value: profile.creditRequirements },
    { label: "Property Requirements", value: profile.propertyRequirements },
  ].filter((block) => block.value?.trim());

  const hasFundingMetrics =
    Boolean(profile.fundingSpeedDays) ||
    Boolean(profile.minFunding) ||
    Boolean(profile.maxFunding);

  const hasContactInfo =
    Boolean(formattedPhone) ||
    Boolean(detail?.email || lender.email) ||
    Boolean(profile.website) ||
    Boolean(locationLine);

  const profileFooter = !loading && (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Close
      </button>
      <button
        type="button"
        disabled={inviting}
        onClick={onInvite}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: BRAND }}
      >
        {inviting ? (
          <RefreshCcw size={16} className="animate-spin" />
        ) : (
          <Handshake size={16} />
        )}
        {inviting ? "Connecting..." : "Connect"}
      </button>
    </div>
  );

  return (
    <ModalShell
      title="Lender Profile"
      subtitle={displayName}
      onClose={onClose}
      wide
      extraWide
      footer={profileFooter}
    >
      {loading ? (
        <ProfileModalSkeleton />
      ) : (
        <div className="space-y-5 pb-2">
          {loadFailed && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Showing summary from marketplace listing. Some details may be
              limited until the full profile loads.
            </div>
          )}

          {/* Logo + Company */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-blue-500/5 p-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <LenderLogo
                brandLogoUrl={detail?.brandLogoUrl ?? lender.brandLogoUrl}
                profileImage={detail?.profileImage ?? lender.profileImage}
                name={displayName}
                alt={`${displayName} logo`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Company
                </p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {displayName}
                </h3>
                {(detail?.name || lender.name) !== displayName && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {detail?.name || lender.name}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StarRating count={isEligible ? 5 : 4} />
                  {isEligible && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Eligible ✓
                    </span>
                  )}
                  {profile.lenderType && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {formatLenderType(profile.lenderType)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {profile.nmls && <span>NMLS #{profile.nmls}</span>}
                  {industries.length > 0 && (
                    <span>{industries.join(" · ")}</span>
                  )}
                </div>
                {states.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {states.map((st) => (
                      <span
                        key={st}
                        title={st}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20"
                      >
                        {abbreviateStateCode(st)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FundingMetric
              label="Loan Range"
              value={formatLoanAmountRange(
                profile.minFunding,
                profile.maxFunding,
              )}
            />
            <FundingMetric
              label="Funding Speed"
              value={formatFundingTime(profile.fundingSpeedDays)}
            />
            <FundingMetric
              label="States Served"
              value={stateSummary.display}
              title={stateSummary.tooltip || undefined}
            />
          </div>

          {/* About */}
          {profile.summary?.trim() && (
            <ProfileBlock icon={<Building2 size={16} />} title="About">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {profile.summary.trim()}
              </p>
            </ProfileBlock>
          )}

          {/* Loan Products */}
          <ProfileBlock icon={<Layers size={16} />} title="Loan Products">
            {products.length > 0 ? (
              <div className="space-y-2">
                {products.map((product) => (
                  <DiscoverProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : fallbackLoanTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fallbackLoanTypes.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No loan products listed.</p>
            )}
          </ProfileBlock>

          {/* Criteria */}
          {criteriaBlocks.length > 0 && (
            <ProfileBlock icon={<FileText size={16} />} title="Criteria">
              <div className="space-y-3">
                {criteriaBlocks.map((block) => (
                  <div key={block.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      {block.label}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {block.value}
                    </p>
                  </div>
                ))}
              </div>
            </ProfileBlock>
          )}

          {/* Contact */}
          {hasFundingMetrics && !profile.fundingSpeedDays && (
            <ProfileBlock icon={<Clock size={16} />} title="Funding">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FundingMetric
                  label="Min Funding"
                  value={formatCompactMoney(String(profile.minFunding ?? ""))}
                />
                <FundingMetric
                  label="Max Funding"
                  value={formatCompactMoney(String(profile.maxFunding ?? ""))}
                />
              </div>
            </ProfileBlock>
          )}

          {/* Contact */}
          {hasContactInfo && (
            <ProfileBlock icon={<Phone size={16} />} title="Contact">
              <div className="grid gap-3 sm:grid-cols-2">
                {formattedPhone && (
                  <ContactRow
                    icon={<Phone size={14} />}
                    label="Phone"
                    value={formattedPhone}
                  />
                )}
                {(detail?.email || lender.email) && (
                  <ContactRow
                    icon={<Mail size={14} />}
                    label="Email"
                    value={detail?.email || lender.email || ""}
                  />
                )}
                {profile.website && (
                  <ContactRow
                    icon={<Globe size={14} />}
                    label="Website"
                    value={
                      <a
                        href={
                          profile.website.startsWith("http")
                            ? profile.website
                            : `https://${profile.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {profile.website}
                      </a>
                    }
                  />
                )}
                {locationLine && (
                  <ContactRow
                    icon={<MapPin size={14} />}
                    label="Location"
                    value={locationLine}
                    className="sm:col-span-2"
                  />
                )}
              </div>
            </ProfileBlock>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function DiscoverProductCard({ product }: { product: LenderProfileProduct }) {
  const productStates = formatStatesSummary(
    parseStatesList(product.statesSupported),
  );
  const documents = product.documents ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-3.5">
      <p className="font-semibold text-sm text-slate-900 dark:text-white">
        {product.loanProductName}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(product.minLoanAmount || product.maxLoanAmount) && (
          <ProductFact
            label="Amount"
            value={formatLoanAmountRange(
              product.minLoanAmount,
              product.maxLoanAmount,
            )}
          />
        )}
        {product.termRange && (
          <ProductFact label="Term" value={product.termRange} />
        )}
        {product.interestRateRange && (
          <ProductFact label="Rate" value={product.interestRateRange} />
        )}
        {product.minCreditScore != null && (
          <ProductFact label="Min FICO" value={String(product.minCreditScore)} />
        )}
        {product.minDscr != null && product.minDscr !== "" && (
          <ProductFact label="Min DSCR" value={`${product.minDscr}x`} />
        )}
        {productStates.display !== "—" && (
          <ProductFact
            label="States"
            value={productStates.display}
            title={productStates.tooltip || undefined}
          />
        )}
      </div>

      {documents.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
            Required Documents
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span className="min-w-0 truncate">
                  {doc.name || doc.code || "Document"}
                </span>
                {doc.isRequired === false && (
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                    Optional
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProductFact({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      <span className="font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {value}
    </span>
  );
}

function ProfileBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function FundingMetric({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-3"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3.5 py-3 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function ProfileModalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

type SendStep = 1 | 2 | 3;

type LenderCompatibility = {
  lenderId: string;
  lenderName: string;
  listedProducts: { code: string; label: string; productId: string }[];
  applicationProductCode: string;
  applicationProductLabel: string;
  isProductListed: boolean;
  isCompatible: boolean;
  eligibleProductId?: string;
  alreadySent?: boolean;
};

export function SendApplicationModal({
  lenders,
  onClose,
  onSent,
}: {
  lenders: ConnectedLender[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<SendStep>(1);
  const [submissions, setSubmissions] = useState<PipelineSubmissionOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [compatLoading, setCompatLoading] = useState(false);
  const [compatibility, setCompatibility] = useState<LenderCompatibility[]>(
    [],
  );
  const [compatCachedForId, setCompatCachedForId] = useState<string | null>(
    null,
  );
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchRecentPipelineSubmissions(100);
        if (!cancelled) setSubmissions(data);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load applications");
          setSubmissions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSubmission = submissions.find(
    (s) => s.submissionId === selectedId,
  );

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => {
      const product = formatLoanTypeLabel(s.loanInfo || "");
      return (
        s.borrower.toLowerCase().includes(q) ||
        (s.applicationNumber || "").toLowerCase().includes(q) ||
        product.toLowerCase().includes(q) ||
        (s.loanInfo || "").toLowerCase().includes(q)
      );
    });
  }, [submissions, searchQuery]);

  const lenderLabel =
    lenders.length === 1
      ? lenders[0].lenderName
      : `${lenders.length} lenders`;

  const maxReachableStep: SendStep = compatCachedForId === selectedId && compatibility.length > 0
    ? 3
    : selectedId
      ? 2
      : 1;

  function handlePrevious() {
    if (step <= 1 || sending || compatLoading) return;
    setStep((step - 1) as SendStep);
  }

  function handleStepClick(target: SendStep) {
    if (target > maxReachableStep || target === step) return;
    if (target === 3 && selectedSubmission) {
      void goToStep3();
      return;
    }
    setStep(target);
  }

  function handleSelectSubmission(submissionId: string) {
    setSelectedId(submissionId);
    if (submissionId !== compatCachedForId) {
      setCompatibility([]);
      setCompatCachedForId(null);
    }
  }

  async function loadCompatibility(submission: PipelineSubmissionOption) {
    setCompatLoading(true);
    try {
      const appCode = (submission.loanInfo || "").trim();
      const appLabel = appCode
        ? formatLoanTypeLabel(appCode)
        : "Not specified";

      const [eligible, ...productResults] = await Promise.all([
        fetchEligibleLendersForSubmission(submission.submissionId),
        ...lenders.map((l) => fetchLenderProducts(l.lenderId)),
      ]);

      const rows: LenderCompatibility[] = lenders.map((lender, index) => {
        const products = (productResults[index] || []).filter((p) => p.isActive);
        const listedProducts = products.map((p) => ({
          code: p.loanProductCode,
          label: formatLoanTypeLabel(p.loanProductCode),
          productId: p.lenderProductId,
        }));

        const isProductListed = appCode
          ? listedProducts.some((p) => p.code === appCode)
          : false;

        const eligibleMatch = eligible.find(
          (e: EligibleLenderMatch) =>
            e.lenderOrgId === lender.lenderId && e.loanProductCode === appCode,
        );

        const listedProduct = listedProducts.find((p) => p.code === appCode);

        return {
          lenderId: lender.lenderId,
          lenderName: lender.lenderName,
          listedProducts,
          applicationProductCode: appCode,
          applicationProductLabel: appLabel,
          isProductListed,
          isCompatible: Boolean(
            isProductListed && eligibleMatch?.canSend && !eligibleMatch?.alreadySent,
          ),
          eligibleProductId:
            eligibleMatch?.lenderProductId || listedProduct?.productId,
          alreadySent: eligibleMatch?.alreadySent,
        };
      });

      setCompatibility(rows);
      setCompatCachedForId(submission.submissionId);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to check compatibility");
    } finally {
      setCompatLoading(false);
    }
  }

  function goToStep2() {
    if (!selectedSubmission) {
      toast.error("Select a loan application first");
      return;
    }
    setStep(2);
  }

  async function goToStep3() {
    if (!selectedSubmission) return;
    if (
      compatCachedForId === selectedSubmission.submissionId &&
      compatibility.length > 0
    ) {
      setStep(3);
      return;
    }
    await loadCompatibility(selectedSubmission);
  }

  async function executeSend(options?: { forceLenderId?: string }) {
    if (!selectedSubmission) return;

    setSending(true);
    try {
      const productIds: string[] = [];
      const skipped: string[] = [];

      for (const row of compatibility) {
        const forceThis =
          options?.forceLenderId && row.lenderId === options.forceLenderId;

        if (row.isCompatible && row.eligibleProductId) {
          productIds.push(row.eligibleProductId);
        } else if (forceThis) {
          if (row.eligibleProductId) {
            productIds.push(row.eligibleProductId);
          } else {
            skipped.push(row.lenderName);
          }
        } else if (!row.isProductListed) {
          skipped.push(row.lenderName);
        } else if (row.eligibleProductId) {
          productIds.push(row.eligibleProductId);
        }
      }

      if (productIds.length === 0) {
        toast.error(
          options?.forceLenderId
            ? "This lender has not listed this product — cannot send."
            : "No compatible lenders to send to.",
        );
        return;
      }

      const uniqueIds = [...new Set(productIds)];
      const results = await sendSubmissionToLenders(
        selectedSubmission.applicationId,
        selectedSubmission.submissionId,
        uniqueIds,
      );

      if (skipped.length > 0) {
        toast.success(
          `Sent to ${results.length} lender(s). Skipped: ${skipped.join(", ")}`,
        );
      } else {
        toast.success(
          `Application sent to ${results.length} lender${results.length === 1 ? "" : "s"}`,
        );
      }

      onSent?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send application");
    } finally {
      setSending(false);
    }
  }

  const stepTitles: Record<SendStep, string> = {
    1: "Select Loan Application",
    2: "Review Application",
    3: "Product Compatibility",
  };

  const singleLender = compatibility.length === 1 ? compatibility[0] : null;
  const compatibleCount = compatibility.filter((c) => c.isCompatible).length;

  const stepHints: Record<SendStep, string> = {
    1: selectedId
      ? "Press Next to review your selection"
      : "Choose one application from the list below",
    2: "Confirm details, then check product compatibility",
    3: compatLoading
      ? "Checking lender products..."
      : compatibleCount > 0
        ? `${compatibleCount} lender${compatibleCount === 1 ? "" : "s"} ready to receive this application`
        : "Review compatibility results before sending",
  };

  const modalFooter = !loading && submissions.length > 0 && (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
        {stepHints[step]}
      </p>
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={step === 1 || sending || compatLoading}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
            step === 1
              ? "invisible pointer-events-none"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          }`}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>

          {step === 1 && (
            <button
              type="button"
              disabled={!selectedId}
              onClick={goToStep2}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              Next: Review
              <ArrowRight size={16} />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={compatLoading}
              onClick={goToStep3}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              {compatLoading ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Next: Compatibility
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}

          {step === 3 && singleLender && singleLender.isCompatible && (
            <button
              type="button"
              disabled={sending}
              onClick={() => executeSend()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              {sending ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Sending..." : "Send Application"}
            </button>
          )}

          {step === 3 && singleLender && !singleLender.isCompatible && !singleLender.alreadySent && (
            <button
              type="button"
              disabled={sending}
              onClick={() => executeSend({ forceLenderId: singleLender.lenderId })}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm ${
                !singleLender.isProductListed
                  ? "text-amber-900 bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200"
                  : "text-white"
              }`}
              style={
                singleLender.isProductListed
                  ? { backgroundColor: BRAND }
                  : undefined
              }
            >
              {sending ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : (
                <AlertTriangle size={16} />
              )}
              Send Anyway
            </button>
          )}

          {step === 3 && compatibility.length > 1 && (
            <button
              type="button"
              disabled={sending || compatibleCount === 0}
              onClick={() => executeSend()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              {sending ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send to Compatible ({compatibleCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ModalShell
      title="Send Application"
      subtitle={`${stepTitles[step]} · ${lenderLabel}`}
      onClose={onClose}
      wide
      extraWide={step === 3}
      footer={modalFooter}
    >
      <div className="space-y-5 pb-2">
        <StepIndicator
          current={step}
          maxReachable={maxReachableStep}
          onStepClick={handleStepClick}
        />

        <div className="rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80 mb-2">
            Sending to
          </p>
          <div className="flex flex-wrap gap-2">
            {lenders.map((lender) => (
              <span
                key={lender.lenderId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20 shadow-sm"
              >
                <Building2 size={12} />
                {lender.lenderName}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-3">
              <Building2 size={22} style={{ color: BRAND }} />
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              No submitted applications
            </p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Submit a loan application first, then return here to send it.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/submit-applications");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: BRAND }}
            >
              Go to Loan Pipeline
              <ArrowRight size={16} />
            </button>
          </div>
        ) : step === 1 ? (
          <>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by borrower, product, or application ID..."
                className="w-full pl-9 pr-3 py-3 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>

            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-medium text-slate-500">
                {filteredSubmissions.length} application
                {filteredSubmissions.length === 1 ? "" : "s"}
                {searchQuery.trim() ? " found" : " available"}
              </p>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Clear selection
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 -mr-1">
              {filteredSubmissions.length === 0 ? (
                <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Search size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">
                    No applications match &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </div>
              ) : (
                filteredSubmissions.map((s) => {
                  const selected = selectedId === s.submissionId;
                  const productLabel = s.loanInfo
                    ? formatLoanTypeLabel(s.loanInfo)
                    : "Product not specified";
                  return (
                    <button
                      key={s.submissionId}
                      type="button"
                      onClick={() => handleSelectSubmission(s.submissionId)}
                      onDoubleClick={() => {
                        handleSelectSubmission(s.submissionId);
                        setStep(2);
                      }}
                      className={`group w-full text-left rounded-xl border p-4 transition-all ${
                        selected
                          ? "border-blue-400 bg-blue-50/60 dark:bg-blue-500/10 shadow-sm ring-2 ring-blue-400/25"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-300 dark:border-slate-600 group-hover:border-blue-300"
                          }`}
                        >
                          {selected && <Check size={12} strokeWidth={3} />}
                        </div>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                          <FileText size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {s.borrower}
                            </p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 shrink-0">
                              {s.amount > 0 ? formatCurrency(s.amount) : "—"}
                            </p>
                          </div>
                          <span className="inline-flex mt-1.5 max-w-full truncate px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {productLabel}
                          </span>
                          <p className="text-xs text-slate-400 mt-2 font-mono">
                            {s.applicationNumber || s.submissionId.slice(0, 12)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Tip: double-click an application to go directly to review
            </p>
          </>
        ) : step === 2 && selectedSubmission ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-500/10 dark:to-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                  <FileText size={20} style={{ color: BRAND }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Selected application
                  </p>
                  <p className="font-bold text-lg text-slate-900 dark:text-white truncate">
                    {selectedSubmission.borrower}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 grid gap-3 sm:grid-cols-2">
              <ReviewField label="Application" value={selectedSubmission.borrower} />
              <ReviewField
                label="Product"
                value={
                  selectedSubmission.loanInfo
                    ? formatLoanTypeLabel(selectedSubmission.loanInfo)
                    : "Not specified"
                }
              />
              <ReviewField
                label="Amount"
                value={
                  selectedSubmission.amount > 0
                    ? formatCurrency(selectedSubmission.amount)
                    : "—"
                }
              />
              <ReviewField
                label="Status"
                value={selectedSubmission.status.replace(/_/g, " ")}
              />
            </div>
            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Change application
              </button>
            </div>
          </div>
        ) : step === 3 ? (
          compatLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <RefreshCcw size={28} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">
                Comparing lender products...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {compatibility.map((row) => (
                <CompatibilityCard key={row.lenderId} row={row} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </ModalShell>
  );
}

function StepIndicator({
  current,
  maxReachable,
  onStepClick,
}: {
  current: SendStep;
  maxReachable: SendStep;
  onStepClick: (step: SendStep) => void;
}) {
  const steps = [
    { n: 1 as SendStep, label: "Select", fullLabel: "Select application" },
    { n: 2 as SendStep, label: "Review", fullLabel: "Review details" },
    { n: 3 as SendStep, label: "Check", fullLabel: "Compatibility check" },
  ];

  const progressPct = ((current - 1) / (steps.length - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="relative px-1">
        <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 dark:bg-slate-700" />
        <div
          className="absolute left-6 top-4 h-0.5 transition-all duration-300"
          style={{ width: `calc((100% - 3rem) * ${progressPct / 100})`, backgroundColor: BRAND }}
        />
        <div className="relative flex justify-between">
          {steps.map((s) => {
            const done = current > s.n;
            const active = current === s.n;
            const reachable = s.n <= maxReachable;
            const clickable = reachable && s.n !== current;

            return (
              <button
                key={s.n}
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick(s.n)}
                title={s.fullLabel}
                className={`flex flex-col items-center gap-1.5 min-w-[72px] ${
                  clickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    active
                      ? "text-white ring-4 ring-blue-100 dark:ring-blue-500/20 scale-110"
                      : done
                        ? "text-white"
                        : reachable
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  }`}
                  style={active || done ? { backgroundColor: BRAND } : undefined}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : s.n}
                </div>
                <span
                  className={`text-[11px] font-semibold text-center leading-tight ${
                    active
                      ? "text-slate-900 dark:text-white"
                      : done
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400"
                  }`}
                >
                  <span className="sm:hidden">{s.label}</span>
                  <span className="hidden sm:inline">{s.fullLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}

function CompatibilityCard({ row }: { row: LenderCompatibility }) {
  const appListed = row.listedProducts.some(
    (p) => p.code === row.applicationProductCode,
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-white">
          {row.lenderName}
        </p>
        {row.isCompatible ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 size={12} />
            Compatible
          </span>
        ) : row.alreadySent ? (
          <span className="text-xs font-semibold text-slate-500">Already sent</span>
        ) : !appListed ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={12} />
            Product not listed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={12} />
            May not qualify
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Lender supports
          </p>
          {row.listedProducts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {row.listedProducts.map((p) => {
                const isMatch = p.code === row.applicationProductCode;
                return (
                  <span
                    key={p.productId}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      isMatch
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {isMatch && <Check size={12} />}
                    {p.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active products listed.</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Your application product
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
            {row.applicationProductLabel}
          </p>
        </div>

        {!row.isCompatible && !row.alreadySent && !appListed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              This lender has not listed this product.
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
              Use &ldquo;Send Anyway&rdquo; in the footer if you still want to proceed.
            </p>
          </div>
        )}

        {row.isCompatible && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={16} />
            Ready to send — product matches and criteria met.
          </div>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use SendApplicationModal */
export function SendDealModal({
  lender,
  onClose,
  onSent,
}: {
  lender: ConnectedLender;
  onClose: () => void;
  onSent?: () => void;
}) {
  return (
    <SendApplicationModal
      lenders={[lender]}
      onClose={onClose}
      onSent={onSent}
    />
  );
}
