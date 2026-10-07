import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiCheck,
  FiDollarSign,
  FiEdit2,
  FiLayers,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import Swal from "sweetalert2";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  EmptyState,
  PaginationBar,
  SubscriptionPageHeader,
  SubscriptionPageShell,
  filterControlClass,
} from "../../components/subscriptions/SubscriptionUi";
import {
  deletePackage,
  fetchPackages as fetchPackagesApi,
  formatPrice,
  parseFeatures,
  parseFeaturesPayload,
  togglePackageStatus,
  USAGE_METRIC_LABELS,
  type SubscriptionPackage,
  type UsageLimits,
  type UsageMetric,
} from "../../lib/subscriptionApi";
import { getPackageCodeLabel } from "../../lib/packageDisplay";

type BillingCycle = "MONTHLY" | "YEARLY";

const YEARLY_SAVE_PERCENT = 20;

const TIER_STYLES: Record<
  string,
  { border: string; badge: string; price: string; accent: string; icon: string }
> = {
  BASIC: {
    border: "border-slate-200 dark:border-slate-700",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    price: "text-slate-900 dark:text-white",
    accent: "border-t-[#13538A]",
    icon: "bg-slate-100 text-[#13538A] dark:bg-slate-800 dark:text-indigo-300",
  },
  STARTER: {
    border: "border-slate-200 dark:border-slate-700",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    price: "text-slate-900 dark:text-white",
    accent: "border-t-[#13538A]",
    icon: "bg-slate-100 text-[#13538A] dark:bg-slate-800 dark:text-indigo-300",
  },
  PRO: {
    border: "border-[#13538A]/35 dark:border-indigo-500/40",
    badge: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
    price: "text-[#13538A] dark:text-indigo-300",
    accent: "border-t-[#13538A]",
    icon: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  ELITE: {
    border: "border-amber-300/60 dark:border-amber-500/35",
    badge: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    price: "text-amber-700 dark:text-amber-300",
    accent: "border-t-amber-500",
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

const DEFAULT_TIER_STYLE = TIER_STYLES.BASIC;

function getTierStyle(code: string) {
  return TIER_STYLES[code.toUpperCase()] ?? DEFAULT_TIER_STYLE;
}

function getPackageDisplayPrice(pkg: SubscriptionPackage, cycle: BillingCycle) {
  if (cycle === "YEARLY" && pkg.priceYearly != null) {
    const yearlyTotal = Number(pkg.priceYearly);
    const meta = parseFeaturesPayload(pkg.features);
    const monthlyEquivalent =
      meta?.priceYearlyMonthly != null &&
      Number.isFinite(Number(meta.priceYearlyMonthly))
        ? Number(meta.priceYearlyMonthly)
        : Math.round(yearlyTotal / 12);
    return {
      amount: monthlyEquivalent,
      billingLabel: "Billed yearly",
      billedToday: yearlyTotal,
      savings: YEARLY_SAVE_PERCENT,
    };
  }
  return {
    amount: Number(pkg.priceMonthly),
    billingLabel: "Billed monthly",
    billedToday: null as number | null,
    savings: null as number | null,
  };
}

function BillingCycleToggle({
  value,
  onChange,
  hasYearly,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  hasYearly: boolean;
}) {
  if (!hasYearly) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => onChange("MONTHLY")}
        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
          value === "MONTHLY"
            ? "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-600"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("YEARLY")}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
          value === "YEARLY"
            ? "bg-[#13538A] text-white dark:bg-indigo-600"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Yearly
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            value === "YEARLY"
              ? "bg-white/20 text-white"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          }`}
        >
          −{YEARLY_SAVE_PERCENT}%
        </span>
      </button>
    </div>
  );
}

function formatUsageLimitValue(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return String(value);
}

function UsageLimitsBadges({ limits }: { limits?: UsageLimits | null }) {
  if (!limits || typeof limits !== "object") return null;

  const displayOrder: UsageMetric[] = [
    "LOAN_APPLICATIONS",
    "CO_BROKERS",
    "LOAN_OFFICERS",
    "LENDER_CONNECTIONS",
  ];
  const entries = displayOrder.filter((key) => {
    if (limits[key] != null) return true;
    // Legacy packages may still store ACTIVE_USERS instead of CO_BROKERS
    if (key === "CO_BROKERS" && limits.ACTIVE_USERS != null) return true;
    return false;
  });

  if (entries.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Usage limits
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((key) => {
          const value =
            key === "CO_BROKERS" && limits.CO_BROKERS == null
              ? limits.ACTIVE_USERS!
              : limits[key]!;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {formatUsageLimitValue(value)}
              </span>
              <span className="text-slate-500">{USAGE_METRIC_LABELS[key]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const FEATURE_PREVIEW = 6;

function FeatureList({
  features,
  iconClass,
}: {
  features: string[];
  iconClass: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (features.length === 0) return null;

  const visible = expanded ? features : features.slice(0, FEATURE_PREVIEW);
  const hiddenCount = features.length - FEATURE_PREVIEW;

  return (
    <div className="mb-6 flex-1">
      <ul className="space-y-2.5">
        {visible.map((feature, index) => {
          const isHeading = feature.startsWith("▸ ");
          const isChild = feature.startsWith("· ");
          if (isHeading) {
            return (
              <li
                key={`heading-${index}-${feature}`}
                className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {feature.replace(/^▸\s*/, "")}
              </li>
            );
          }
          return (
            <li
              key={`feature-${index}-${feature}`}
              className={`flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 ${
                isChild ? "ml-4" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${iconClass}`}
              >
                <FiCheck size={11} strokeWidth={2.5} />
              </span>
              <span>{isChild ? feature.replace(/^·\s*/, "") : feature}</span>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more features`}
        </button>
      )}
    </div>
  );
}

const AllSubscriptions = () => {
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canCreate = can("CREATE_SUBSCRIPTION");
  const canUpdate = can("UPDATE_SUBSCRIPTION");
  const canDelete = can("DELETE_SUBSCRIPTION");

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("YEARLY");

  const totalPages = Math.ceil(total / limit);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (statusFilter === "active" && !pkg.isActive) return false;
      if (statusFilter === "inactive" && pkg.isActive) return false;
      if (!q) return true;
      return (
        pkg.name.toLowerCase().includes(q) ||
        pkg.code.toLowerCase().includes(q) ||
        (pkg.description || "").toLowerCase().includes(q)
      );
    });
  }, [packages, search, statusFilter]);

  const stats = useMemo(() => {
    const active = packages.filter((p) => p.isActive).length;
    const prices = packages
      .map((p) => {
        if (billingCycle === "YEARLY" && p.priceYearly != null) {
          const meta = parseFeaturesPayload(p.features);
          if (
            meta?.priceYearlyMonthly != null &&
            Number.isFinite(Number(meta.priceYearlyMonthly))
          ) {
            return Number(meta.priceYearlyMonthly);
          }
          return Math.round(Number(p.priceYearly) / 12);
        }
        return Number(p.priceMonthly);
      })
      .filter((n) => !Number.isNaN(n));
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const hasYearly = packages.some((p) => p.priceYearly != null);

    return { active, min, max, hasYearly };
  }, [packages, billingCycle]);

  const loadPackages = async (page = 1) => {
    try {
      setLoadingList(true);

      const json = await fetchPackagesApi({ page, limit });

      if (!json.success) {
        toast.error(json.message || "Failed to load subscription packages");
        return;
      }

      setPackages(
        (json.data || []).map((item) => ({
          ...item,
          id: String(item.id),
          name: item.name ?? "",
          code: item.code ?? "",
          sortOrder: Number(item.sortOrder ?? 0),
          isActive: Boolean(item.isActive),
          isPopular: Boolean(item.isPopular),
        })),
      );

      setTotal(json.meta?.total || 0);
      setCurrentPage(json.meta?.page || 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load subscription packages");
    } finally {
      setLoadingList(false);
    }
  };

  const handleToggleStatus = async (pkg: SubscriptionPackage) => {
    const nextActive = !pkg.isActive;
    const result = await Swal.fire({
      title: nextActive ? "Activate package?" : "Deactivate package?",
      text: nextActive
        ? `"${pkg.name}" will become available for new subscriptions.`
        : `"${pkg.name}" will be hidden from new signups.`,
      icon: nextActive ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: nextActive ? "#059669" : "#d97706",
      cancelButtonColor: "#64748b",
      confirmButtonText: nextActive ? "Activate" : "Deactivate",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      setTogglingId(pkg.id);

      const json = await togglePackageStatus(pkg.id, nextActive);
      if (!json.success) {
        await Swal.fire({
          title: "Update failed",
          text: json.message || "Status update failed",
          icon: "error",
          confirmButtonColor: "#13538A",
        });
        return;
      }

      await Swal.fire({
        title: nextActive ? "Package activated" : "Package deactivated",
        text: `"${pkg.name}" is now ${nextActive ? "active" : "inactive"}.`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
      await loadPackages(currentPage);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (pkg: SubscriptionPackage) => {
    const result = await Swal.fire({
      title: "Delete package?",
      text: `"${pkg.name}" will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(pkg.id);

      const json = await deletePackage(pkg.id);
      if (!json.success) {
        toast.error(json.message || "Delete failed");
        return;
      }

      toast.success("Package deleted");
      await loadPackages(currentPage);
    } finally {
      setDeletingId(null);
    }
  };

  const gotoPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    loadPackages(page);
  };

  useEffect(() => {
    loadPackages(1);
  }, []);

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Subscription Packages"
        description="Manage broker subscription tiers, monthly/yearly pricing, and included features."
        actions={
          canCreate ? (
            <Link
              to="/all-subscriptions/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4470]"
            >
              <FiPlus size={16} />
              Add Package
            </Link>
          ) : null
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Total plans",
            value: total,
            icon: <FiLayers size={18} />,
            tone: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
          },
          {
            label: "Active plans",
            value: stats.active,
            icon: <FiCheck size={18} />,
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
          },
          {
            label: "Price range / mo",
            value:
              total > 0
                ? `${formatPrice(stats.min)} – ${formatPrice(stats.max)}`
                : "—",
            hint: billingCycle === "YEARLY" ? "yearly display" : "monthly",
            icon: <FiDollarSign size={18} />,
            tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}
              >
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="truncate text-xl font-bold text-slate-900 dark:text-white">
                  {stat.value}
                </p>
                {stat.hint ? (
                  <p className="text-[11px] text-slate-400">{stat.hint}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-1">
          <div className="relative flex-1">
            <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or description..."
              className={`w-full py-2.5 pr-3 pl-10 ${filterControlClass}`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            className={filterControlClass}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        <div className="flex justify-center lg:justify-end">
          <BillingCycleToggle
            value={billingCycle}
            onChange={setBillingCycle}
            hasYearly={stats.hasYearly}
          />
        </div>
      </div>

      {loadingList ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<FiAlertCircle size={28} />}
          title="No subscription packages yet"
          description="Create your first plan to start offering subscriptions to brokers."
          action={
            canCreate ? (
              <Link
                to="/all-subscriptions/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4470]"
              >
                <FiPlus size={16} />
                Create first package
              </Link>
            ) : null
          }
        />
      ) : filteredPackages.length === 0 ? (
        <EmptyState
          icon={<FiSearch size={28} />}
          title="No packages match your filters"
          description="Try a different search or status filter."
          action={
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-sm font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPackages.map((pkg) => {
            const style = getTierStyle(pkg.code);
            const features = parseFeatures(pkg.features);
            const featureMeta = parseFeaturesPayload(pkg.features);
            const display = getPackageDisplayPrice(pkg, billingCycle);
            const badgeLabel =
              featureMeta?.badge || (pkg.isPopular ? "Most Popular" : null);

            return (
              <article
                key={pkg.id}
                className={`flex flex-col overflow-hidden rounded-2xl border border-t-4 bg-white transition-colors hover:border-slate-300 dark:bg-slate-900 dark:hover:border-slate-600 ${style.border} ${style.accent} ${
                  !pkg.isActive ? "opacity-65" : ""
                }`}
              >
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
                      >
                        {getPackageCodeLabel(pkg.code)}
                      </span>
                      {badgeLabel ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#13538A] px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-indigo-600">
                          <HiSparkles size={11} />
                          {badgeLabel}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(pkg)}
                      disabled={togglingId === pkg.id || !canUpdate}
                      title={
                        pkg.isActive
                          ? "Click to deactivate"
                          : "Click to activate"
                      }
                      className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        pkg.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30"
                      }`}
                    >
                      {togglingId === pkg.id
                        ? "…"
                        : pkg.isActive
                          ? "Active"
                          : "Inactive"}
                    </button>
                  </div>

                  <div className="mb-4 min-w-0">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {pkg.name}
                    </h3>
                    {pkg.description ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {pkg.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      <span
                        className={`text-3xl font-extrabold tracking-tight ${style.price}`}
                      >
                        {formatPrice(display.amount)}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        /mo
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {display.billingLabel}
                      {display.billedToday != null
                        ? ` · ${formatPrice(display.billedToday)}/yr`
                        : ""}
                    </p>
                    {display.savings != null && display.savings > 0 ? (
                      <p className="mt-1.5 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Save {display.savings}% vs monthly
                      </p>
                    ) : null}
                    {billingCycle === "MONTHLY" && pkg.priceYearly != null ? (
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        Yearly: {formatPrice(pkg.priceYearly)}/yr
                      </p>
                    ) : null}
                  </div>

                  {(featureMeta?.includedUsers != null ||
                    featureMeta?.maxUsers != null ||
                    featureMeta?.extraUserPrice != null) && (
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {[
                        {
                          label: "Included",
                          value: featureMeta.includedUsers ?? "—",
                        },
                        {
                          label: "Max",
                          value: featureMeta.maxUsers ?? "—",
                        },
                        {
                          label: "Extra",
                          value:
                            featureMeta.extraUserPrice != null
                              ? `${formatPrice(featureMeta.extraUserPrice)}/m`
                              : "—",
                        },
                      ].map((cell) => (
                        <div
                          key={cell.label}
                          className="rounded-lg border border-slate-100 px-2 py-2 text-center dark:border-slate-800"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {cell.label}
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                            {cell.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <UsageLimitsBadges limits={pkg.usageLimits} />

                  <FeatureList features={features} iconClass={style.icon} />

                  <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {canUpdate ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/all-subscriptions/edit?id=${pkg.id}`)
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#13538A]/25 bg-[#13538A]/[0.04] px-3 text-sm font-semibold text-[#13538A] transition hover:bg-[#13538A] hover:text-white dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white"
                      >
                        <FiEdit2 size={15} />
                        Edit package
                      </button>
                    ) : (
                      <div />
                    )}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(pkg)}
                        disabled={deletingId === pkg.id}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-600 hover:text-white disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
                        title="Delete package"
                      >
                        <FiTrash2 size={15} />
                        <span className="hidden sm:inline">
                          {deletingId === pkg.id ? "…" : "Delete"}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        total={total}
        noun="packages"
        onPageChange={gotoPage}
      />
    </SubscriptionPageShell>
  );
};

export default AllSubscriptions;
