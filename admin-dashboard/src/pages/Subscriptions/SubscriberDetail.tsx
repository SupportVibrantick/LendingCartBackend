import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FiArrowLeft,
  FiCalendar,
  FiInfo,
  FiRefreshCw,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import SubscriberPageHeader from "../../components/subscriptions/SubscriberPageHeader";
import SubscriberSubNav from "../../components/subscriptions/SubscriberSubNav";
import {
  StatusBadge,
  SubscriptionPageShell,
  filterControlClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  fetchPackages,
  fetchSubscriberDetail,
  formatPrice,
  generateInvoice,
  markInvoicePaid,
  refreshSubscriptionUsage,
  USAGE_METRIC_LABELS,
  type BillingCycle,
  type SubscriberDetail as SubscriberDetailType,
  type SubscriptionPackage,
} from "../../lib/subscriptionApi";
import { getSubscriberOrgId } from "../../lib/subscriberNavigation";

function tierGradient(code?: string) {
  const c = String(code || "").toUpperCase();
  if (c === "ELITE") return "from-[#0B3A63] via-[#13538A] to-[#18B6B4]";
  if (c === "PRO") return "from-[#13538A] to-[#18B6B4]";
  return "from-[#13538A] to-[#0B3A63]";
}

export default function SubscriberDetail() {
  const location = useLocation();
  const orgId = useMemo(
    () => getSubscriberOrgId(location.state as { organizationId?: string } | null),
    [location.state],
  );
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIBERS");
  const canManageInvoices = can("MANAGE_SUBSCRIPTION_INVOICES");

  const [detail, setDetail] = useState<SubscriberDetailType | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [changeOpen, setChangeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changeForm, setChangeForm] = useState({
    packageId: "",
    billingCycle: "MONTHLY" as BillingCycle,
    notes: "",
    generateInvoice: false,
  });

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
      const sub = json.data.subscription;
      if (sub) {
        setChangeForm({
          packageId: sub.package.id,
          billingCycle: sub.billingCycle,
          notes: sub.notes || "",
          generateInvoice: false,
        });
      }
    } catch {
      toast.error("Failed to load subscriber");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    load();
    fetchPackages({ limit: 50, isActive: true }).then((json) => {
      if (json.success) setPackages(json.data || []);
    });
  }, [orgId]);

  if (!orgId) {
    return <Navigate to="/subscription-subscribers" replace />;
  }

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    try {
      setSaving(true);
      const json = await changeSubscriptionPlan({
        organizationId: orgId,
        packageId: changeForm.packageId,
        billingCycle: changeForm.billingCycle,
        notes: changeForm.notes || undefined,
        generateInvoice: changeForm.generateInvoice,
      });
      if (!json.success) {
        toast.error(json.message || "Change plan failed");
        return;
      }
      toast.success("Plan updated");
      setChangeOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (immediate: boolean) => {
    if (!orgId) return;
    const result = await Swal.fire({
      title: immediate ? "Cancel immediately?" : "Cancel at period end?",
      text: immediate
        ? "The subscription will end right away."
        : "The subscription remains active until the current period ends.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    const json = await cancelSubscription({ organizationId: orgId, immediate });
    if (!json.success) {
      toast.error(json.message || "Cancel failed");
      return;
    }
    toast.success(json.message || "Subscription cancelled");
    load();
  };

  const handleRefreshUsage = async () => {
    if (!orgId) return;
    const json = await refreshSubscriptionUsage({ organizationId: orgId });
    if (!json.success) {
      toast.error(json.message || "Refresh failed");
      return;
    }
    toast.success("Usage refreshed");
    load();
  };

  const handleGenerateInvoice = async () => {
    const subId = detail?.subscription?.id;
    if (!subId) return;
    const result = await Swal.fire({
      title: "Generate invoice?",
      text: "A new invoice will be created for the current billing period.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generate",
    });
    if (!result.isConfirmed) return;

    const json = await generateInvoice({ organizationSubscriptionId: subId });
    if (!json.success) {
      toast.error(json.message || "Failed to generate invoice");
      return;
    }
    toast.success("Invoice generated");
    load();
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const json = await markInvoicePaid(invoiceId);
    if (!json.success) {
      toast.error(json.message || "Failed to mark paid");
      return;
    }
    toast.success("Invoice marked as paid");
    load();
  };

  if (loading) {
    return (
      <SubscriptionPageShell>
        <div className="mb-6 h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="mb-6 h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800 xl:col-span-2" />
        </div>
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

  const { organization, subscription, history } = detail;
  const price = subscription
    ? subscription.billingCycle === "YEARLY"
      ? subscription.package.priceYearly
      : subscription.package.priceMonthly
    : null;

  return (
    <SubscriptionPageShell>
      <Link
        to="/subscription-subscribers"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#13538A] dark:hover:text-indigo-400"
      >
        <FiArrowLeft size={14} />
        Back to subscribers
      </Link>

      <SubscriptionNav />

      <SubscriberSubNav organizationId={orgId} activeTab="details" />

      <SubscriberPageHeader
        organization={organization}
        packageCode={subscription?.package?.code}
        subscriptionStatus={subscription?.status}
        eyebrow="Subscriber Details"
        actions={
          canManage && subscription ? (
            <>
              <button type="button" onClick={handleRefreshUsage} className={secondaryBtnClass}>
                <FiRefreshCw size={14} />
                Refresh Usage
              </button>
              <button
                type="button"
                onClick={() => setChangeOpen(true)}
                className={primaryBtnClass}
              >
                Change Plan
              </button>
              <button
                type="button"
                onClick={() => handleCancel(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              >
                Cancel at Period End
              </button>
              <button
                type="button"
                onClick={() => handleCancel(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/80 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
              >
                Cancel Now
              </button>
            </>
          ) : null
        }
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
            Assign a plan from the subscribers list to unlock permissions and billing.
          </p>
          <Link
            to="/subscription-subscribers"
            className="text-sm font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
          >
            Go to subscribers
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-1">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div
                className={`relative bg-gradient-to-br ${tierGradient(subscription.package.code)} px-5 py-5 text-white`}
              >
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl"
                  aria-hidden
                />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
                  Current Plan
                </p>
                <div className="relative mt-2 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{subscription.package.name}</h2>
                    <p className="mt-0.5 text-sm text-white/70">{subscription.package.code}</p>
                  </div>
                  <HiSparkles className="mb-1 text-white/70" size={22} />
                </div>
                <p className="relative mt-4 text-3xl font-extrabold tracking-tight">
                  {formatPrice(price)}
                  <span className="ml-1 text-sm font-medium text-white/75">
                    / {subscription.billingCycle === "YEARLY" ? "year" : "month"}
                  </span>
                </p>
              </div>
              <div className="p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <StatusBadge status={subscription.status} />
                  {subscription.cancelAtPeriodEnd && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Cancels at period end
                    </span>
                  )}
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                    <dt className="inline-flex items-center gap-2 text-slate-500">
                      <FiCalendar size={14} className="text-[#18B6B4]" />
                      Period start
                    </dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                    <dt className="inline-flex items-center gap-2 text-slate-500">
                      <FiCalendar size={14} className="text-[#18B6B4]" />
                      Period end
                    </dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </dd>
                  </div>
                  {subscription.trialEndsAt && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#18B6B4]/25 bg-[#18B6B4]/5 px-3.5 py-2.5 dark:border-[#18B6B4]/30 dark:bg-[#18B6B4]/10">
                      <dt className="text-[#13538A] dark:text-[#18B6B4]">Trial ends</dt>
                      <dd className="font-semibold text-[#0B3A63] dark:text-slate-100">
                        {new Date(subscription.trialEndsAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </dl>
                {subscription.notes ? (
                  <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A] dark:bg-[#18B6B4]/15 dark:text-[#18B6B4]">
                      <FiInfo size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#18B6B4]">
                        Notes
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {subscription.notes}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {history.length > 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  History
                </h2>
                <ul className="space-y-3">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                          {h.package.name} ·{" "}
                          {h.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                        </p>
                        <div className="mt-1.5">
                          <StatusBadge status={h.status} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-6 xl:col-span-2">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Usage Tracking
                </h2>
              </div>
              {subscription.usageRecords.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                  No usage data yet. Refresh usage to compute.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {subscription.usageRecords.map((u) => {
                    const pct =
                      u.limitValue && u.limitValue > 0
                        ? Math.min(100, Math.round((u.usedValue / u.limitValue) * 100))
                        : 0;
                    const bar =
                      pct >= 90
                        ? "from-rose-500 to-rose-400"
                        : pct >= 70
                          ? "from-amber-500 to-amber-400"
                          : "from-[#13538A] to-[#18B6B4]";
                    return (
                      <div
                        key={u.id}
                        className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-800/40 dark:to-slate-900"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white">
                            {USAGE_METRIC_LABELS[u.metric]}
                          </p>
                          <p className="text-xs font-bold tabular-nums text-slate-500">
                            {pct}%
                          </p>
                        </div>
                        <p className="mb-2 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                          {u.usedValue}
                          <span className="text-sm font-medium text-slate-400">
                            {u.limitValue != null ? ` / ${u.limitValue}` : " · unlimited"}
                          </span>
                        </p>
                        {u.limitValue != null && (
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Invoices
                </h2>
                {canManageInvoices && (
                  <button
                    type="button"
                    onClick={handleGenerateInvoice}
                    className="rounded-xl bg-[#13538A]/10 px-3 py-1.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/15 dark:text-indigo-300"
                  >
                    Generate Invoice
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscription.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                          No invoices yet
                        </td>
                      </tr>
                    ) : (
                      subscription.invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3.5 font-semibold">
                            {formatPrice(inv.amount)}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                            {inv.paidAt ? (
                              <div className="text-[11px] font-medium text-emerald-600">
                                Paid {new Date(inv.paidAt).toLocaleDateString()}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canManageInvoices && inv.status === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => handleMarkPaid(inv.id)}
                                className="text-xs font-semibold text-emerald-600 hover:underline"
                              >
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {changeOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setChangeOpen(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <form
            onSubmit={handleChangePlan}
            className="relative w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Change Plan</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Update package, billing cycle, or notes for this broker.
              </p>
            </div>
            <select
              value={changeForm.packageId}
              onChange={(e) => setChangeForm((f) => ({ ...f, packageId: e.target.value }))}
              className={`w-full ${filterControlClass}`}
              required
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPrice(p.priceMonthly)}/mo
                </option>
              ))}
            </select>
            <select
              value={changeForm.billingCycle}
              onChange={(e) =>
                setChangeForm((f) => ({
                  ...f,
                  billingCycle: e.target.value as BillingCycle,
                }))
              }
              className={`w-full ${filterControlClass}`}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
            <textarea
              rows={2}
              value={changeForm.notes}
              onChange={(e) => setChangeForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes"
              className={`w-full resize-none ${filterControlClass}`}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={changeForm.generateInvoice}
                onChange={(e) =>
                  setChangeForm((f) => ({ ...f, generateInvoice: e.target.checked }))
                }
              />
              Generate invoice for plan change
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChangeOpen(false)}
                className={`flex-1 ${secondaryBtnClass}`}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
                {saving ? "Saving..." : "Update Plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </SubscriptionPageShell>
  );
}
