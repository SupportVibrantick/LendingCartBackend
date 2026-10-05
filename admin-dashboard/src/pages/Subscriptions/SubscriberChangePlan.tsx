import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheck, FiRepeat, FiSave } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import OrgFeaturesPanel from "../../components/subscriptions/OrgFeaturesPanel";
import SubscriberPageHeader from "../../components/subscriptions/SubscriberPageHeader";
import {
  SubscriptionPageShell,
  filterControlClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
import {
  changeSubscriptionPlan,
  fetchPackageFeatureDefaults,
  fetchPackages,
  fetchSubscriberDetail,
  formatPrice,
  type BillingCycle,
  type FeatureCatalogGroup,
  type SubscriberDetail as SubscriberDetailType,
  type SubscriptionPackage,
} from "../../lib/subscriptionApi";
import {
  getSubscriberOrgId,
  SUBSCRIBER_DETAIL_PATH,
} from "../../lib/subscriberNavigation";
import { getPackageCodeLabel } from "../../lib/packageDisplay";

function packageTierTone(code?: string | null) {
  const c = String(code || "").toUpperCase();
  if (c === "ELITE") {
    return {
      ring: "ring-[#0B3A63] border-[#0B3A63]",
      badge: "bg-[#0B3A63] text-white",
    };
  }
  if (c === "PRO") {
    return {
      ring: "ring-[#18B6B4] border-[#18B6B4]",
      badge: "bg-[#18B6B4] text-white",
    };
  }
  return {
    ring: "ring-[#13538A] border-[#13538A]",
    badge: "bg-[#13538A] text-white",
  };
}

export default function SubscriberChangePlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const orgId = useMemo(
    () => getSubscriberOrgId(location.state as { organizationId?: string } | null),
    [location.state],
  );
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIBERS");

  const [detail, setDetail] = useState<SubscriberDetailType | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const [packageId, setPackageId] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [notes, setNotes] = useState("");
  const [generateInvoice, setGenerateInvoice] = useState(false);

  const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogGroup[]>([]);
  const [featureKeys, setFeatureKeys] = useState<string[]>([]);
  const [packageDefaults, setPackageDefaults] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [detailJson, packagesJson] = await Promise.all([
        fetchSubscriberDetail(orgId),
        fetchPackages({ limit: 50, isActive: true }),
      ]);
      if (!detailJson.success || !detailJson.data) {
        toast.error(detailJson.message || "Failed to load subscriber");
        return;
      }
      setDetail(detailJson.data);
      setFeatureCatalog(detailJson.data.featureCatalog || []);

      const pkgs = packagesJson.success ? packagesJson.data || [] : [];
      setPackages(pkgs);

      const sub = detailJson.data.subscription;
      if (!sub) {
        toast.error("No active subscription to change");
        return;
      }

      setPackageId(sub.package.id);
      setBillingCycle(sub.billingCycle);
      setNotes("");
      setGenerateInvoice(false);

      const catalogKeySet = new Set(
        (detailJson.data.featureCatalog || []).flatMap((g) =>
          g.items.map((i) => i.key),
        ),
      );
      const currentEnabled = (detailJson.data.orgFeatures?.enabledFeatures || []).filter(
        (k) => catalogKeySet.has(k),
      );
      const defaults = (detailJson.data.orgFeatures?.packageDefaults || []).filter(
        (k) => catalogKeySet.has(k),
      );
      setPackageDefaults(defaults);
      setFeatureKeys(currentEnabled.length > 0 ? currentEnabled : defaults);
    } catch {
      toast.error("Failed to load change-plan page");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPackageDefaults = useCallback(
    async (nextPackageId: string) => {
      if (!orgId || !nextPackageId) return;
      try {
        setLoadingDefaults(true);
        const json = await fetchPackageFeatureDefaults({
          packageId: nextPackageId,
          organizationId: orgId,
        });
        if (!json.success || !json.data) {
          toast.error(json.message || "Failed to load package permissions");
          return;
        }
        const catalogKeySet = new Set(
          featureCatalog.flatMap((g) => g.items.map((i) => i.key)),
        );
        const defaults = (json.data.defaults || []).filter((k) =>
          catalogKeySet.has(k),
        );
        setPackageDefaults(defaults);
        setFeatureKeys(defaults);
        toast.success(
          `Permissions loaded for ${json.data.packageName || getPackageCodeLabel(json.data.packageCode)}`,
        );
      } catch {
        toast.error("Failed to load package permissions");
      } finally {
        setLoadingDefaults(false);
      }
    },
    [orgId, featureCatalog],
  );

  const handlePackageSelect = (id: string) => {
    setPackageId(id);
    void applyPackageDefaults(id);
  };

  if (!orgId) {
    return <Navigate to="/subscription-subscribers" replace />;
  }

  if (!canManage) {
    return (
      <SubscriptionPageShell>
        <p className="py-20 text-center text-slate-500">
          You do not have permission to change plans.
        </p>
      </SubscriptionPageShell>
    );
  }

  const selectedPkg = packages.find((p) => p.id === packageId);
  const price =
    selectedPkg == null
      ? null
      : billingCycle === "YEARLY"
        ? selectedPkg.priceYearly ?? selectedPkg.priceMonthly
        : selectedPkg.priceMonthly;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !packageId) {
      toast.error("Select a package");
      return;
    }
    try {
      setSaving(true);
      const json = await changeSubscriptionPlan({
        organizationId: orgId,
        packageId,
        billingCycle,
        notes: notes.trim() || undefined,
        generateInvoice,
        features: featureKeys,
      });
      if (!json.success) {
        toast.error(json.message || "Change plan failed");
        return;
      }
      toast.success("Plan and permissions updated");
      navigate(SUBSCRIBER_DETAIL_PATH, { state: { organizationId: orgId } });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SubscriptionPageShell>
        <div className="mb-6 h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </SubscriptionPageShell>
    );
  }

  if (!detail?.subscription) {
    return (
      <SubscriptionPageShell>
        <div className="py-20 text-center">
          <p className="mb-4 text-slate-500">No active subscription to change</p>
          <Link
            to="/subscription-subscribers"
            className="font-semibold text-[#13538A] dark:text-indigo-400"
          >
            Back to subscribers
          </Link>
        </div>
      </SubscriptionPageShell>
    );
  }

  const { organization, subscription } = detail;

  return (
    <SubscriptionPageShell>
      <div className="pb-28">
        <Link
          to="/subscription-subscribers"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#13538A] dark:hover:text-indigo-400"
        >
          <FiArrowLeft size={14} />
          Back to subscribers
        </Link>

        <SubscriptionNav />

        <SubscriberPageHeader
          organization={organization}
          packageCode={subscription.package?.code}
          subscriptionStatus={subscription.status}
          eyebrow="Change Plan"
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <FiRepeat size={18} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Plan & billing
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Current:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {subscription.package?.name}
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    ({getPackageCodeLabel(subscription.package?.code)}) ·{" "}
                    {subscription.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                New package
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {packages.map((pkg) => {
                  const selected = packageId === pkg.id;
                  const isCurrent = subscription.package?.id === pkg.id;
                  const tone = packageTierTone(pkg.code);
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      disabled={saving || loadingDefaults}
                      onClick={() => handlePackageSelect(pkg.id)}
                      className={`relative rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? `${tone.ring} ring-2 bg-white shadow-sm dark:bg-slate-800`
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50"
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-2 top-2 text-[#13538A]">
                          <FiCheck size={14} />
                        </span>
                      )}
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}
                      >
                        {getPackageCodeLabel(pkg.code)}
                      </span>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {pkg.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatPrice(pkg.priceMonthly)}/mo
                        {isCurrent ? " · current" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Billing cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) =>
                    setBillingCycle(e.target.value as BillingCycle)
                  }
                  className={`w-full ${filterControlClass}`}
                  disabled={saving}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="flex flex-col justify-end sm:col-span-2">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Price
                  </p>
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {price != null ? formatPrice(price) : "—"}
                    <span className="ml-1 text-xs font-medium text-slate-400">
                      /{billingCycle === "YEARLY" ? "yr" : "mo"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes{" "}
                <span className="font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal note for this plan change..."
                className={`w-full resize-none ${filterControlClass}`}
                disabled={saving}
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/40">
              <input
                type="checkbox"
                checked={generateInvoice}
                onChange={(e) => setGenerateInvoice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#13538A] focus:ring-[#13538A]"
                disabled={saving}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  Generate invoice
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Create a billing invoice when this plan is changed.
                </span>
              </span>
            </label>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Broker permissions
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Auto-loaded from the selected package. You can enable any
                  permission — even if it is not included in that package.
                </p>
              </div>
              <button
                type="button"
                disabled={saving || loadingDefaults || !packageId}
                onClick={() => void applyPackageDefaults(packageId)}
                className={secondaryBtnClass}
              >
                {loadingDefaults ? "Loading…" : "Reset to package defaults"}
              </button>
            </div>

            {featureCatalog.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-slate-500">
                  No permission catalog available.
                </p>
              </div>
            ) : (
              <OrgFeaturesPanel
                catalog={featureCatalog}
                value={featureKeys}
                packageDefaults={packageDefaults}
                isCustom
                disabled={saving || loadingDefaults}
                onChange={setFeatureKeys}
              />
            )}
          </section>
        </form>
      </div>

      <div className="fixed right-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md left-0 lg:left-[90px] dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              {featureKeys.length}
            </span>{" "}
            permissions selected
            {selectedPkg ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium">
                  {selectedPkg.name} / {billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                </span>
              </>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Link
              to={SUBSCRIBER_DETAIL_PATH}
              state={{ organizationId: orgId }}
              className={secondaryBtnClass}
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving || loadingDefaults || !packageId}
              onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
              className={primaryBtnClass}
            >
              <FiSave size={16} />
              {saving ? "Saving…" : "Save plan & permissions"}
            </button>
          </div>
        </div>
      </div>
    </SubscriptionPageShell>
  );
}
