import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiSave, FiX } from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import { useSidebar } from "../../context/SidebarContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import OrgFeaturesPanel from "../../components/subscriptions/OrgFeaturesPanel";
import OrgUsageLimitsPanel from "../../components/subscriptions/OrgUsageLimitsPanel";
import SubscriberPageHeader from "../../components/subscriptions/SubscriberPageHeader";
import SubscriberSubNav from "../../components/subscriptions/SubscriberSubNav";
import {
  SubscriptionPageShell,
  primaryBtnClass,
  secondaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
import {
  fetchSubscriberDetail,
  updateSubscriberFeatures,
  updateSubscriberUsageLimits,
  type FeatureCatalogGroup,
  type OrgUsageLimitsPayload,
  type SubscriberDetail as SubscriberDetailType,
  type UsageLimits,
} from "../../lib/subscriptionApi";
import {
  getSubscriberOrgId,
  SUBSCRIBER_DETAIL_PATH,
} from "../../lib/subscriberNavigation";

export default function SubscriberPermissions() {
  const location = useLocation();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const orgId = useMemo(
    () => getSubscriberOrgId(location.state as { organizationId?: string } | null),
    [location.state],
  );
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIBERS");

  const [detail, setDetail] = useState<SubscriberDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogGroup[]>([]);
  const [featureKeys, setFeatureKeys] = useState<string[]>([]);
  const [packageDefaults, setPackageDefaults] = useState<string[]>([]);
  const [featuresCustom, setFeaturesCustom] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featuresDirty, setFeaturesDirty] = useState(false);
  const [usageLimits, setUsageLimits] = useState<OrgUsageLimitsPayload | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);

  const load = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const json = await fetchSubscriberDetail(orgId);
      if (!json.success || !json.data) {
        toast.error(json.message || "Failed to load subscriber");
        return;
      }
      setDetail(json.data);
      const catalog = json.data.featureCatalog || [];
      setFeatureCatalog(catalog);
      const catalogKeySet = new Set(
        catalog.flatMap((group) => group.items.map((item) => item.key)),
      );
      const rawKeys = json.data.orgFeatures?.enabledFeatures || [];
      setFeatureKeys(rawKeys.filter((key) => catalogKeySet.has(key)));
      setPackageDefaults(
        (json.data.orgFeatures?.packageDefaults || []).filter((key) =>
          catalogKeySet.has(key),
        ),
      );
      setFeaturesCustom(Boolean(json.data.orgFeatures?.isCustom));
      setUsageLimits(json.data.orgUsageLimits || null);
      setFeaturesDirty(false);
    } catch {
      toast.error("Failed to load subscriber");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    load();
  }, [orgId]);

  if (!orgId) {
    return <Navigate to="/subscription-subscribers" replace />;
  }

  const handleSaveFeatures = async () => {
    if (!orgId) return;
    try {
      setSavingFeatures(true);
      const json = await updateSubscriberFeatures(orgId, featureKeys);
      if (!json.success) {
        toast.error(json.message || "Failed to save permissions");
        return;
      }
      toast.success("Broker permissions saved");
      setFeaturesDirty(false);
      setFeaturesCustom(true);
      if (json.data?.enabledFeatures) {
        setFeatureKeys(json.data.enabledFeatures);
      }
      load();
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleSaveLimits = async (limits: UsageLimits) => {
    if (!orgId) return;
    try {
      setSavingLimits(true);
      const json = await updateSubscriberUsageLimits(orgId, { limits });
      if (!json.success) {
        toast.error(json.message || "Failed to save usage limits");
        return;
      }
      toast.success("Usage limits saved");
      if (json.data) setUsageLimits(json.data);
      else load();
    } finally {
      setSavingLimits(false);
    }
  };

  const handleResetLimits = async () => {
    if (!orgId) return;
    try {
      setSavingLimits(true);
      const json = await updateSubscriberUsageLimits(orgId, { resetToPackage: true });
      if (!json.success) {
        toast.error(json.message || "Failed to reset usage limits");
        return;
      }
      toast.success("Limits reset to package defaults");
      if (json.data) setUsageLimits(json.data);
      else load();
    } finally {
      setSavingLimits(false);
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

  if (!detail) {
    return (
      <SubscriptionPageShell>
        <div className="py-20 text-center">
          <p className="mb-4 text-slate-500">Subscriber not found</p>
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
      <div className={featuresDirty && canManage ? "pb-24" : ""}>
        <Link
          to="/subscription-subscribers"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#13538A] dark:hover:text-indigo-400"
        >
          <FiArrowLeft size={14} />
          Back to subscribers
        </Link>

        <SubscriptionNav />

        <SubscriberSubNav organizationId={orgId} activeTab="permissions" />

        <SubscriberPageHeader
          organization={organization}
          packageCode={subscription?.package?.code}
          subscriptionStatus={subscription?.status}
          eyebrow="Broker Permissions"
        />

        {!subscription ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <HiSparkles size={24} />
            </div>
            <p className="mb-2 text-lg font-semibold text-slate-800 dark:text-white">
              No active subscription
            </p>
            <p className="mb-5 text-sm text-slate-500">
              Assign a plan first, then configure broker permissions.
            </p>
            <Link
              to={SUBSCRIBER_DETAIL_PATH}
              state={{ organizationId: orgId }}
              className="text-sm font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
            >
              Go to details
            </Link>
          </div>
        ) : (
          <>
            <OrgUsageLimitsPanel
              data={usageLimits}
              disabled={!canManage}
              saving={savingLimits}
              onSave={handleSaveLimits}
              onReset={handleResetLimits}
            />
            {featureCatalog.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-slate-500">No permission catalog available.</p>
              </div>
            ) : (
              <OrgFeaturesPanel
                catalog={featureCatalog}
                value={featureKeys}
                packageDefaults={packageDefaults}
                isCustom={featuresCustom}
                disabled={!canManage || savingFeatures}
                onChange={(next) => {
                  setFeatureKeys(next);
                  setFeaturesDirty(true);
                }}
              />
            )}
          </>
        )}
      </div>

      {canManage && featuresDirty && (
        <div
          className={`fixed right-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[left] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 ${
            isMobileOpen
              ? "left-0"
              : isExpanded || isHovered
                ? "left-0 lg:left-[290px]"
                : "left-0 lg:left-[90px]"
          }`}
        >
          <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                Unsaved permission changes
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {featureKeys.length} selected · loan officers limited to this set
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={savingFeatures}
                onClick={() => {
                  setFeatureKeys(detail.orgFeatures?.enabledFeatures || packageDefaults);
                  setFeaturesDirty(false);
                }}
                className={secondaryBtnClass}
              >
                <FiX size={14} />
                Discard
              </button>
              <button
                type="button"
                disabled={savingFeatures}
                onClick={handleSaveFeatures}
                className={primaryBtnClass}
              >
                <FiSave size={16} />
                {savingFeatures ? "Saving..." : "Save permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SubscriptionPageShell>
  );
}
