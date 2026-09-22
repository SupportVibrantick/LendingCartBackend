import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiFileText,
  FiMoreVertical,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { HiOutlineUserPlus } from "react-icons/hi2";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  FilterBar,
  PaginationBar,
  StatusBadge,
  SubscriptionPageHeader,
  SubscriptionPageShell,
  TableSkeleton,
  filterControlClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  assignSubscription,
  fetchBrokerOptions,
  fetchPackages,
  fetchSubscribers,
  type BrokerOption,
  formatPrice,
  type BillingCycle,
  type SubscriberRow,
  type SubscriptionPackage,
} from "../../lib/subscriptionApi";
import {
  openSubscriberDetail,
  openSubscriberPermissions,
} from "../../lib/subscriberNavigation";

const MENU_WIDTH = 176;

export default function SubscriptionSubscribers() {
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIBERS");

  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHasSub, setFilterHasSub] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignLockedBroker, setAssignLockedBroker] = useState<BrokerOption | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [assignForm, setAssignForm] = useState({
    organizationId: "",
    packageId: "",
    billingCycle: "MONTHLY" as BillingCycle,
    trialDays: "0",
    notes: "",
  });

  const openRowMenu = (orgId: string, hasSub: boolean, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = hasSub || !canManage ? 96 : 140;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 8;
    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === orgId ? null : orgId));
  };

  const activeMenuRow = useMemo(
    () => rows.find((r) => r.organizationId === openMenuId) || null,
    [rows, openMenuId],
  );

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-subscriber-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(target as Node)) {
        setOpenMenuId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    const onScroll = () => setOpenMenuId(null);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [openMenuId]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterHasSub]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const json = await fetchSubscribers({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: filterStatus || undefined,
        hasSubscription: filterHasSub ? (filterHasSub as "true" | "false") : undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Failed to load subscribers");
        return;
      }
      setRows(json.data || []);
      setTotal(json.meta?.total || 0);
      if (json.meta?.page) setPage(json.meta.page);
    } catch {
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterHasSub, limit]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchPackages({ limit: 50, isActive: true }).then((json) => {
      if (json.success) setPackages(json.data || []);
    });
    fetchBrokerOptions(200).then((json) => {
      if (json.success) setBrokers(json.data || []);
    });
  }, []);

  const totalPages = Math.ceil(total / limit);

  const pageStats = useMemo(() => {
    const withPlan = rows.filter((r) => r.subscription).length;
    const trials = rows.filter((r) => r.subscription?.status === "TRIAL").length;
    const active = rows.filter((r) => r.subscription?.status === "ACTIVE").length;
    return { withPlan, trials, active };
  }, [rows]);

  const openAssign = (row?: SubscriberRow) => {
    if (row) {
      const locked: BrokerOption = {
        id: row.organizationId,
        name: row.organizationName,
        email: row.organizationEmail,
      };
      setAssignLockedBroker(locked);
      setBrokers((prev) =>
        prev.some((b) => b.id === locked.id) ? prev : [locked, ...prev],
      );
      setAssignForm({
        organizationId: locked.id,
        packageId: packages[0]?.id || "",
        billingCycle: "MONTHLY",
        trialDays: "0",
        notes: "",
      });
    } else {
      setAssignLockedBroker(null);
      setAssignForm({
        organizationId: "",
        packageId: packages[0]?.id || "",
        billingCycle: "MONTHLY",
        trialDays: "0",
        notes: "",
      });
    }
    setAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.organizationId || !assignForm.packageId) {
      toast.error("Organization and package are required");
      return;
    }
    try {
      setAssigning(true);
      const json = await assignSubscription({
        organizationId: assignForm.organizationId,
        packageId: assignForm.packageId,
        billingCycle: assignForm.billingCycle,
        trialDays: Number(assignForm.trialDays) || 0,
        notes: assignForm.notes || undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Assign failed");
        return;
      }
      toast.success("Subscription assigned");
      setAssignOpen(false);
      fetchRows();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Subscribers"
        description="Manage broker subscriptions, plans, and billing cycles."
        actions={
          canManage ? (
            <button type="button" onClick={() => openAssign()} className={primaryBtnClass}>
              <FiPlus size={16} />
              Assign Plan
            </button>
          ) : null
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
              <FiUsers size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">On this page</p>
              <p className="text-lg font-bold">{rows.length} brokers</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <HiOutlineUserPlus size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">With plan (page)</p>
              <p className="text-lg font-bold">
                {pageStats.withPlan}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  · {pageStats.active} active
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <FiUsers size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">Trials (page)</p>
              <p className="text-lg font-bold">{pageStats.trials}</p>
            </div>
          </div>
        </div>
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by broker name, email, phone, or plan..."
            className={`w-full py-2.5 pr-10 pl-10 ${filterControlClass}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={filterHasSub}
          onChange={(e) => setFilterHasSub(e.target.value)}
          className={filterControlClass}
        >
          <option value="">All brokers</option>
          <option value="true">With subscription</option>
          <option value="false">Without subscription</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={filterControlClass}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <button type="button" onClick={() => fetchRows()} className={secondaryBtnClass}>
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </FilterBar>

      {debouncedSearch && (
        <p className="mb-4 text-xs text-slate-500">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Broker Organization</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period End</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {debouncedSearch
                      ? "No subscribers match your search"
                      : "No subscribers found"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const sub = row.subscription;
                  const price = sub
                    ? sub.billingCycle === "YEARLY"
                      ? sub.package?.priceYearly
                      : sub.package?.priceMonthly
                    : null;

                  return (
                    <tr
                      key={row.organizationId}
                      className="border-t border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.organizationName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.organizationEmail || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {sub?.package ? (
                          <div>
                            <span className="font-medium">{sub.package.name}</span>
                            <span className="ml-1 text-xs text-slate-400">
                              ({sub.package.code})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">No plan</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {sub?.billingCycle
                          ? sub.billingCycle === "YEARLY"
                            ? "Yearly"
                            : "Monthly"
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sub?.status} />
                        {sub?.cancelAtPeriodEnd ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-600">
                            Cancels at period end
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {sub?.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {price != null ? formatPrice(price) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          data-subscriber-menu-trigger="true"
                          title="More actions"
                          aria-label="More actions"
                          aria-expanded={openMenuId === row.organizationId}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRowMenu(
                              row.organizationId,
                              Boolean(sub),
                              e.currentTarget,
                            );
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <FiMoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeMenuRow &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: MENU_WIDTH,
            }}
            className="z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                openSubscriberDetail(navigate, activeMenuRow.organizationId);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiFileText size={14} className="text-[#13538A]" />
              Details
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                openSubscriberPermissions(navigate, activeMenuRow.organizationId);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiShield size={14} className="text-[#18B6B4]" />
              Permissions
            </button>
            {!activeMenuRow.subscription && canManage ? (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  openAssign(activeMenuRow);
                }}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-slate-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <FiPlus size={14} />
                Assign plan
              </button>
            ) : null}
          </div>,
          document.body,
        )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        noun="brokers"
        onPageChange={setPage}
      />

      {assignOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setAssignLockedBroker(null);
              setAssignOpen(false);
            }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <form
            onSubmit={handleAssign}
            className="relative w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Assign Subscription
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Grant a plan to a broker organization.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Broker</label>
              {assignLockedBroker ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {assignLockedBroker.name}
                  </p>
                  {assignLockedBroker.email ? (
                    <p className="text-xs text-slate-500">{assignLockedBroker.email}</p>
                  ) : null}
                </div>
              ) : (
                <select
                  value={assignForm.organizationId}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, organizationId: e.target.value }))
                  }
                  className={`w-full ${filterControlClass}`}
                  required
                >
                  <option value="">Select broker...</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.email ? `(${b.email})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Package</label>
              <select
                value={assignForm.packageId}
                onChange={(e) => setAssignForm((f) => ({ ...f, packageId: e.target.value }))}
                className={`w-full ${filterControlClass}`}
                required
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {formatPrice(p.priceMonthly)}/mo
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Billing</label>
                <select
                  value={assignForm.billingCycle}
                  onChange={(e) =>
                    setAssignForm((f) => ({
                      ...f,
                      billingCycle: e.target.value as BillingCycle,
                    }))
                  }
                  className={`w-full ${filterControlClass}`}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Trial days
                </label>
                <input
                  type="number"
                  min="0"
                  value={assignForm.trialDays}
                  onChange={(e) => setAssignForm((f) => ({ ...f, trialDays: e.target.value }))}
                  className={`w-full ${filterControlClass}`}
                />
              </div>
            </div>
            <textarea
              rows={2}
              value={assignForm.notes}
              onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className={`w-full resize-none ${filterControlClass}`}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setAssignLockedBroker(null);
                  setAssignOpen(false);
                }}
                className={`flex-1 ${secondaryBtnClass}`}
              >
                Cancel
              </button>
              <button type="submit" disabled={assigning} className={`flex-1 ${primaryBtnClass}`}>
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>
        </div>
      )}
    </SubscriptionPageShell>
  );
}
