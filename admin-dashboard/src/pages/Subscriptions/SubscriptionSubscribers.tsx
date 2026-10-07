import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiCheck,
  FiClock,
  FiFileText,
  FiMoreVertical,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
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
  openSubscriberChangePlan,
  openSubscriberDetail,
  openSubscriberPermissions,
} from "../../lib/subscriberNavigation";
import { getPackageCodeLabel } from "../../lib/packageDisplay";

const MENU_WIDTH = 176;

const flatPrimaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:opacity-60";
const flatSecondaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function packageTierTone(code?: string | null) {
  const c = String(code || "").toUpperCase();
  if (c === "ELITE") {
    return {
      ring: "ring-[#0B3A63] border-[#0B3A63]",
      badge: "bg-[#0B3A63] text-white",
      soft: "bg-[#0B3A63]/8 text-[#0B3A63]",
    };
  }
  if (c === "PRO") {
    return {
      ring: "ring-[#18B6B4] border-[#18B6B4]",
      badge: "bg-[#18B6B4] text-white",
      soft: "bg-[#18B6B4]/10 text-[#0B6B69]",
    };
  }
  return {
    ring: "ring-[#13538A] border-[#13538A]",
    badge: "bg-[#13538A] text-white",
    soft: "bg-[#13538A]/10 text-[#13538A]",
  };
}

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
    generateInvoice: false,
  });

  const openRowMenu = (orgId: string, hasSub: boolean, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = canManage ? (hasSub ? 148 : 140) : 96;
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
        generateInvoice: false,
      });
    } else {
      setAssignLockedBroker(null);
      setAssignForm({
        organizationId: "",
        packageId: packages[0]?.id || "",
        billingCycle: "MONTHLY",
        trialDays: "0",
        notes: "",
        generateInvoice: false,
      });
    }
    setAssignOpen(true);
  };

  const openChangePlan = (row: SubscriberRow) => {
    if (!row.subscription?.package) {
      toast.error("No active subscription to change");
      return;
    }
    openSubscriberChangePlan(navigate, row.organizationId);
  };

  const closeAssign = () => {
    setAssignLockedBroker(null);
    setAssignOpen(false);
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
        generateInvoice: assignForm.generateInvoice,
      });
      if (!json.success) {
        toast.error(json.message || "Assign failed");
        return;
      }
      toast.success("Subscription assigned");
      closeAssign();
      fetchRows();
    } finally {
      setAssigning(false);
    }
  };

  const selectedAssignPkg = packages.find((p) => p.id === assignForm.packageId);
  const assignPrice =
    selectedAssignPkg == null
      ? null
      : assignForm.billingCycle === "YEARLY"
        ? selectedAssignPkg.priceYearly ?? selectedAssignPkg.priceMonthly
        : selectedAssignPkg.priceMonthly;

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Subscribers"
        description="Manage broker subscriptions, plans, and billing cycles."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className={flatSecondaryBtn}
            >
              <FiRefreshCw
                size={15}
                className={loading ? "animate-spin" : undefined}
              />
              Refresh
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={() => openAssign()}
                className={flatPrimaryBtn}
              >
                <FiPlus size={16} />
                Assign Plan
              </button>
            ) : null}
          </div>
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300">
              <FiUsers size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                On this page
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {rows.length}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  brokers
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FiUserCheck size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                With plan
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {pageStats.withPlan}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  · {pageStats.active} active
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <FiClock size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Trials
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {pageStats.trials}
              </p>
            </div>
          </div>
        </div>
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <FiSearch
            className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by broker name, email, phone, or plan..."
            className={`w-full py-2.5 pr-10 pl-10 ${filterControlClass}`}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
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
      </FilterBar>

      {debouncedSearch ? (
        <p className="mb-4 text-xs text-slate-500">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period end</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <FiUsers size={22} />
                      </span>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {debouncedSearch
                          ? "No subscribers match your search"
                          : "No subscribers found"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {debouncedSearch
                          ? "Try a different broker name, email, or plan."
                          : "Assign a plan to a broker to get started."}
                      </p>
                    </div>
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
                  const initial =
                    (row.organizationName || "?").charAt(0).toUpperCase();

                  return (
                    <tr
                      key={row.organizationId}
                      className="border-t border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-xs font-bold text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300">
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {row.organizationName}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {row.organizationEmail || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {sub?.package ? (
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {sub.package.name}
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              {getPackageCodeLabel(sub.package.code)}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            No plan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {sub?.billingCycle
                          ? sub.billingCycle === "YEARLY"
                            ? "Yearly"
                            : "Monthly"
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={sub?.status} />
                        {sub?.cancelAtPeriodEnd ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-600">
                            Cancels at period end
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {sub?.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        {price != null ? formatPrice(price) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
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
            className="z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 dark:border-slate-700 dark:bg-slate-900"
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
            {activeMenuRow.subscription && canManage ? (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  openChangePlan(activeMenuRow);
                }}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-[#13538A] transition hover:bg-[#13538A]/5 dark:border-slate-800 dark:text-[#5BA3D9] dark:hover:bg-slate-800"
              >
                <FiRepeat size={14} />
                Change plan
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
            onClick={closeAssign}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <form
            onSubmit={handleAssign}
            className="relative flex max-h-[min(920px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-[#0B3A63] via-[#13538A] to-[#18B6B4] px-6 py-5 text-white dark:border-slate-800">
              <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <FiPackage size={18} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Assign Subscription</h2>
                    <p className="mt-0.5 text-xs text-white/75">
                      Grant a plan to a broker organization.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAssign}
                  className="rounded-xl p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label="Close dialog"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Broker
                </label>
                {assignLockedBroker ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {assignLockedBroker.name}
                    </p>
                    {assignLockedBroker.email ? (
                      <p className="mt-0.5 text-xs text-slate-500">{assignLockedBroker.email}</p>
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Package
                </label>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {packages.map((pkg) => {
                    const selected = assignForm.packageId === pkg.id;
                    const tone = packageTierTone(pkg.code);
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setAssignForm((f) => ({ ...f, packageId: pkg.id }))}
                        className={`relative rounded-2xl border px-3 py-3 text-left transition ${
                          selected
                            ? `${tone.ring} ring-2 bg-white dark:bg-slate-800`
                            : "border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40"
                        }`}
                      >
                        {selected ? (
                          <span
                            className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full ${tone.badge}`}
                          >
                            <FiCheck size={11} strokeWidth={3} />
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tone.soft}`}
                        >
                          {getPackageCodeLabel(pkg.code)}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                          {pkg.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatPrice(pkg.priceMonthly)}
                          <span className="text-slate-400">/mo</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Billing cycle
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                  {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((cycle) => {
                    const active = assignForm.billingCycle === cycle;
                    return (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setAssignForm((f) => ({ ...f, billingCycle: cycle }))}
                        className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          active
                            ? "bg-white text-[#13538A] dark:bg-slate-900 dark:text-[#5BA3D9]"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {cycle === "YEARLY" ? "Yearly" : "Monthly"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Trial days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={assignForm.trialDays}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, trialDays: e.target.value }))
                    }
                    className={`w-full ${filterControlClass}`}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Price
                    </p>
                    <p className="text-base font-bold text-slate-900 dark:text-white">
                      {assignPrice != null ? formatPrice(assignPrice) : "—"}
                      <span className="ml-1 text-xs font-medium text-slate-400">
                        /{assignForm.billingCycle === "YEARLY" ? "yr" : "mo"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal note for this assignment..."
                  className={`w-full resize-none ${filterControlClass}`}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                <input
                  type="checkbox"
                  checked={assignForm.generateInvoice}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, generateInvoice: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#13538A] focus:ring-[#13538A]"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                    Generate invoice
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Create a billing invoice when this plan is assigned.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
              <button
                type="button"
                onClick={closeAssign}
                className={`flex-1 ${flatSecondaryBtn}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigning}
                className={`flex-1 ${flatPrimaryBtn}`}
              >
                {assigning ? "Assigning..." : "Assign plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </SubscriptionPageShell>
  );
}
