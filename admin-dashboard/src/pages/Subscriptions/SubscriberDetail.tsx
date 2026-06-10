import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  fetchPackages,
  fetchSubscriberDetail,
  formatPrice,
  generateInvoice,
  markInvoicePaid,
  refreshSubscriptionUsage,
  STATUS_COLORS,
  USAGE_METRIC_LABELS,
  type BillingCycle,
  type SubscriberDetail as SubscriberDetailType,
  type SubscriptionPackage,
} from "../../lib/subscriptionApi";
import { getSubscriberOrgId } from "../../lib/subscriberNavigation";

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
      <div className="px-6 py-20 text-center text-slate-500">Loading subscriber...</div>
    );
  }

  if (!detail) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-slate-500 mb-4">Subscriber not found</p>
        <Link to="/subscription-subscribers" className="text-[#13538A] font-semibold">
          Back to subscribers
        </Link>
      </div>
    );
  }

  const { organization, subscription, history } = detail;
  const price = subscription
    ? subscription.billingCycle === "YEARLY"
      ? subscription.package.priceYearly
      : subscription.package.priceMonthly
    : null;

  return (
    <div className="px-4 sm:px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
      <Link
        to="/subscription-subscribers"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#13538A] mb-4"
      >
        <FiArrowLeft size={14} />
        Back to subscribers
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#18B6B4] mb-1">
            Subscriber Details
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#13538A] dark:text-indigo-400">
            {organization.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {organization.email || "—"} · {organization.phone || "—"}
          </p>
        </div>
        {canManage && subscription && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefreshUsage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-white dark:bg-slate-900 text-sm font-semibold"
            >
              <FiRefreshCw size={14} />
              Refresh Usage
            </button>
            <button
              onClick={() => setChangeOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#13538A] text-white text-sm font-semibold"
            >
              Change Plan
            </button>
            <button
              onClick={() => handleCancel(false)}
              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold"
            >
              Cancel at Period End
            </button>
            <button
              onClick={() => handleCancel(true)}
              className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 text-sm font-semibold"
            >
              Cancel Now
            </button>
          </div>
        )}
      </div>

      <SubscriptionNav />

      {!subscription ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-slate-500 mb-4">This broker has no active subscription.</p>
          <Link
            to="/subscription-subscribers"
            className="text-[#13538A] font-semibold text-sm"
          >
            Assign from subscribers list
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
                Current Plan
              </h2>
              <div className="text-2xl font-bold">{subscription.package.name}</div>
              <div className="text-sm text-slate-500 mt-1">{subscription.package.code}</div>
              <div className="mt-4 text-3xl font-extrabold text-[#13538A] dark:text-indigo-400">
                {formatPrice(price)}
                <span className="text-sm font-normal text-slate-500 ml-1">
                  / {subscription.billingCycle === "YEARLY" ? "year" : "month"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[subscription.status]}`}
                >
                  {subscription.status}
                </span>
                {subscription.cancelAtPeriodEnd && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    Cancels at period end
                  </span>
                )}
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Period start</dt>
                  <dd>{new Date(subscription.currentPeriodStart).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Period end</dt>
                  <dd>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</dd>
                </div>
                {subscription.trialEndsAt && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Trial ends</dt>
                    <dd>{new Date(subscription.trialEndsAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </div>

            {history.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
                  History
                </h2>
                <ul className="space-y-3 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between gap-3">
                      <span>
                        {h.package.name} · {h.billingCycle}
                      </span>
                      <span className="text-slate-500 shrink-0">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
                Usage Tracking
              </h2>
              {subscription.usageRecords.length === 0 ? (
                <p className="text-sm text-slate-500">No usage data yet. Refresh usage to compute.</p>
              ) : (
                <div className="space-y-4">
                  {subscription.usageRecords.map((u) => {
                    const pct =
                      u.limitValue && u.limitValue > 0
                        ? Math.min(100, Math.round((u.usedValue / u.limitValue) * 100))
                        : 0;
                    return (
                      <div key={u.id}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium">{USAGE_METRIC_LABELS[u.metric]}</span>
                          <span className="text-slate-500">
                            {u.usedValue}
                            {u.limitValue != null ? ` / ${u.limitValue}` : " (unlimited)"}
                          </span>
                        </div>
                        {u.limitValue != null && (
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
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

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Invoices
                </h2>
                {canManageInvoices && (
                  <button
                    onClick={handleGenerateInvoice}
                    className="text-xs font-semibold text-[#13538A] hover:underline"
                  >
                    Generate Invoice
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscription.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No invoices yet
                        </td>
                      </tr>
                    ) : (
                      subscription.invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3">{formatPrice(inv.amount)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status]}`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canManageInvoices && inv.status === "PENDING" && (
                              <button
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
            className="absolute inset-0 bg-slate-900/50"
          />
          <form
            onSubmit={handleChangePlan}
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold">Change Plan</h2>
            <select
              value={changeForm.packageId}
              onChange={(e) => setChangeForm((f) => ({ ...f, packageId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800"
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
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
            <textarea
              rows={2}
              value={changeForm.notes}
              onChange={(e) => setChangeForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes"
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 resize-none"
            />
            <label className="flex items-center gap-2 text-sm">
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
              <button type="button" onClick={() => setChangeOpen(false)} className="flex-1 py-2.5 border rounded-xl">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#13538A] text-white font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Update Plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
