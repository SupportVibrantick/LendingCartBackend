import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiCheck,
  FiDollarSign,
  FiLayers,
  FiPlus,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { MdModeEdit, MdDelete } from "react-icons/md";
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
  primaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
import {
  createPackage,
  deletePackage,
  fetchPackages as fetchPackagesApi,
  formatPrice,
  parseFeatures,
  togglePackageStatus,
  updatePackage,
  USAGE_METRIC_LABELS,
  type SubscriptionPackage,
  type UsageLimits,
  type UsageMetric,
} from "../../lib/subscriptionApi";
import { getPackageCodeLabel } from "../../lib/packageDisplay";

type PackageForm = {
  name: string;
  code: string;
  priceMonthly: string;
  priceYearly: string;
  description: string;
  features: string;
  sortOrder: string;
  isPopular: boolean;
  usageLimitsJson: string;
};

const TIER_STYLES: Record<
  string,
  { ring: string; badge: string; price: string; glow: string; icon: string }
> = {
  BASIC: {
    ring: "ring-slate-200 dark:ring-slate-700",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    price: "text-slate-800 dark:text-slate-100",
    glow: "from-slate-100/80 to-white dark:from-slate-800/50 dark:to-slate-900",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  // Display name is "Starter"; package code remains BASIC
  STARTER: {
    ring: "ring-slate-200 dark:ring-slate-700",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    price: "text-slate-800 dark:text-slate-100",
    glow: "from-slate-100/80 to-white dark:from-slate-800/50 dark:to-slate-900",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  PRO: {
    ring: "ring-[#13538A]/30 dark:ring-indigo-500/40",
    badge: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
    price: "text-[#13538A] dark:text-indigo-400",
    glow: "from-[#13538A]/8 to-white dark:from-indigo-500/10 dark:to-slate-900",
    icon: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  ELITE: {
    ring: "ring-amber-300/50 dark:ring-amber-500/30",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    price: "text-amber-700 dark:text-amber-400",
    glow: "from-amber-50 to-white dark:from-amber-500/10 dark:to-slate-900",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

const DEFAULT_TIER_STYLE = TIER_STYLES.BASIC;

function getTierStyle(code: string) {
  return TIER_STYLES[code.toUpperCase()] ?? DEFAULT_TIER_STYLE;
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
    <div className="mb-5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Usage limits
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map((key) => {
          const value =
            key === "CO_BROKERS" && limits.CO_BROKERS == null
              ? limits.ACTIVE_USERS!
              : limits[key]!;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <span className="font-semibold text-slate-800 dark:text-slate-100">
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
        {visible.map((feature) => {
          const isHeading = feature.startsWith("▸ ");
          if (isHeading) {
            return (
              <li
                key={feature}
                className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {feature.replace(/^▸\s*/, "")}
              </li>
            );
          }
          return (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconClass}`}
              >
                <FiCheck size={11} />
              </span>
              <span>{feature}</span>
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

const EMPTY_FORM: PackageForm = {
  name: "",
  code: "",
  priceMonthly: "",
  priceYearly: "",
  description: "",
  features: "",
  sortOrder: "0",
  isPopular: false,
  usageLimitsJson: "",
};

function parseUsageLimitsJson(raw: string): UsageLimits | undefined {
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid usage limits JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

  const out: UsageLimits = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === "" || value == null) continue;
    const n = Number(value);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      out[key as keyof UsageLimits] = n;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const AllSubscriptions = () => {
  const { can } = useAdminPermissions();
  const canCreate = can("CREATE_SUBSCRIPTION");
  const canUpdate = can("UPDATE_SUBSCRIPTION");
  const canDelete = can("DELETE_SUBSCRIPTION");

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

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
    const prices = packages.map((p) => Number(p.priceMonthly)).filter((n) => !Number.isNaN(n));
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;

    return { active, min, max };
  }, [packages]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (pkg: SubscriptionPackage) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      code: pkg.code,
      priceMonthly: String(pkg.priceMonthly),
      priceYearly: pkg.priceYearly != null ? String(pkg.priceYearly) : "",
      description: pkg.description || "",
      features: pkg.features || "",
      sortOrder: String(pkg.sortOrder ?? 0),
      isPopular: Boolean(pkg.isPopular),
      usageLimitsJson: pkg.usageLimits ? JSON.stringify(pkg.usageLimits, null, 2) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.priceMonthly || Number(form.priceMonthly) <= 0) {
      toast.error("Valid monthly price is required");
      return;
    }

    try {
      setSaving(true);

      let usageLimits: UsageLimits | undefined;
      try {
        usageLimits = parseUsageLimitsJson(form.usageLimitsJson);
      } catch {
        toast.error("Usage limits must be valid JSON");
        return;
      }

      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        priceMonthly: Number(form.priceMonthly),
        priceYearly: form.priceYearly ? Number(form.priceYearly) : null,
        description: form.description.trim() || undefined,
        features: form.features.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isPopular: form.isPopular,
        usageLimits: usageLimits ?? null,
      };

      const json = editingId
        ? await updatePackage({ id: editingId, ...payload })
        : await createPackage(payload);

      if (!json.success) {
        toast.error(json.message || "Save failed");
        return;
      }

      toast.success(editingId ? "Package updated" : "Package created");
      await loadPackages(currentPage);
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (pkg: SubscriptionPackage) => {
    try {
      setTogglingId(pkg.id);

      const json = await togglePackageStatus(pkg.id, !pkg.isActive);
      if (!json.success) {
        toast.error(json.message || "Status update failed");
        return;
      }

      toast.success(pkg.isActive ? "Package deactivated" : "Package activated");
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
      if (editingId === pkg.id) closeModal();
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
        description="Manage broker subscription tiers, monthly pricing, and included features."
        actions={
          canCreate ? (
            <button type="button" onClick={openCreateModal} className={primaryBtnClass}>
              <FiPlus size={16} />
              Add Package
            </button>
          ) : null
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-400">
              <FiLayers size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Plans</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <FiCheck size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Plans</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <FiDollarSign size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Price Range</p>
              <p className="text-lg font-bold">
                {total > 0
                  ? `${formatPrice(stats.min)} – ${formatPrice(stats.max)}`
                  : "—"}
                <span className="text-xs font-normal text-slate-500"> /mo</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
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
              <button type="button" onClick={openCreateModal} className={primaryBtnClass}>
                <FiPlus size={16} />
                Create first package
              </button>
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredPackages.map((pkg) => {
            const style = getTierStyle(pkg.code);
            const features = parseFeatures(pkg.features);
            return (
              <article
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${style.glow} bg-white shadow-sm ring-1 transition-all duration-300 hover:shadow-lg dark:bg-slate-900 ${style.ring} ${
                  !pkg.isActive ? "opacity-70" : ""
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#13538A] px-3 py-1 text-xs font-semibold text-white shadow-md">
                      <HiSparkles size={12} />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide ${style.badge}`}
                      >
                        {getPackageCodeLabel(pkg.code)}
                      </span>
                      <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                        {pkg.name}
                      </h3>
                      {pkg.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                          {pkg.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(pkg)}
                      disabled={togglingId === pkg.id}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        pkg.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                      }`}
                    >
                      {togglingId === pkg.id ? "..." : pkg.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <div className="mb-5">
                    <span className={`text-4xl font-extrabold tracking-tight ${style.price}`}>
                      {formatPrice(pkg.priceMonthly)}
                    </span>
                    <span className="ml-1 text-sm text-slate-500">/ month</span>
                    {pkg.priceYearly != null && (
                      <p className="mt-1 text-sm text-slate-500">
                        or {formatPrice(pkg.priceYearly)} / year
                      </p>
                    )}
                  </div>

                  <UsageLimitsBadges limits={pkg.usageLimits} />

                  <FeatureList features={features} iconClass={style.icon} />

                  <div className="flex items-center gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEditModal(pkg)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold transition-colors hover:bg-[#13538A] hover:text-white dark:bg-slate-800 dark:hover:bg-indigo-600"
                      >
                        <MdModeEdit size={16} />
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(pkg)}
                        disabled={deletingId === pkg.id}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50 dark:bg-slate-800"
                        title="Delete package"
                      >
                        <MdDelete size={18} />
                      </button>
                    )}
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

      {modalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            onClick={closeModal}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingId ? "Edit Package" : "New Package"}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingId ? "Update plan details" : "Add a subscription tier"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Package Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Pro"
                    className={`w-full ${filterControlClass}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Code
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="PRO"
                    disabled={Boolean(editingId)}
                    className={`w-full font-mono text-sm disabled:opacity-60 ${filterControlClass}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Monthly Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceMonthly}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priceMonthly: e.target.value }))
                      }
                      placeholder="399"
                      className={`w-full py-2.5 pr-3 pl-7 ${filterControlClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Yearly Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceYearly}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priceYearly: e.target.value }))
                      }
                      placeholder="3990"
                      className={`w-full py-2.5 pr-3 pl-7 ${filterControlClass}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="isPopular"
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isPopular: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <label
                    htmlFor="isPopular"
                    className="text-sm font-medium text-slate-600 dark:text-slate-300"
                  >
                    Mark as Most Popular plan
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    className={`w-full ${filterControlClass}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Who is this plan for?"
                    className={`w-full resize-none ${filterControlClass}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Features
                  </label>
                  <textarea
                    rows={4}
                    value={form.features}
                    onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                    placeholder="Separate features with commas or new lines"
                    className={`w-full resize-none ${filterControlClass}`}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Example: Core loan pipeline, Advanced analytics, Priority support
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Usage Limits (JSON)
                  </label>
                  <textarea
                    rows={4}
                    value={form.usageLimitsJson}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, usageLimitsJson: e.target.value }))
                    }
                    placeholder='{"LOAN_APPLICATIONS": 100, "ACTIVE_USERS": 25}'
                    className={`w-full resize-none font-mono text-xs ${filterControlClass}`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 ${primaryBtnClass}`}
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SubscriptionPageShell>
  );
};

export default AllSubscriptions;
