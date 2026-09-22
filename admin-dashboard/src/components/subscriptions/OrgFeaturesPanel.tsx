import { useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiHome,
  FiLayers,
  FiSearch,
  FiShield,
  FiSliders,
  FiUsers,
} from "react-icons/fi";
import type { FeatureCatalogGroup } from "../../lib/subscriptionApi";

type Props = {
  catalog: FeatureCatalogGroup[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  packageDefaults?: string[];
  isCustom?: boolean;
};

function groupIcon(groupId: string) {
  if (groupId === "loan_categories") return FiHome;
  if (groupId.startsWith("loan_types_")) return FiLayers;
  if (
    groupId === "loan_officers" ||
    groupId === "co_brokers" ||
    groupId === "borrowers" ||
    groupId === "contacts"
  ) {
    return FiUsers;
  }
  return FiSliders;
}

function groupAccent(groupId: string) {
  if (groupId === "loan_categories") {
    return "from-sky-500/15 to-blue-500/5 text-sky-700 dark:text-sky-300";
  }
  if (groupId.startsWith("loan_types_")) {
    return "from-violet-500/15 to-indigo-500/5 text-violet-700 dark:text-violet-300";
  }
  if (groupId === "loan_officers") {
    return "from-[#13538A]/15 to-[#18B6B4]/10 text-[#13538A] dark:text-indigo-300";
  }
  if (groupId === "co_brokers") {
    return "from-teal-500/15 to-emerald-500/10 text-teal-700 dark:text-teal-300";
  }
  if (groupId === "borrowers") {
    return "from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300";
  }
  if (groupId === "contacts") {
    return "from-rose-500/15 to-pink-500/10 text-rose-700 dark:text-rose-300";
  }
  if (groupId === "integrations") {
    return "from-emerald-500/15 to-teal-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (groupId === "dashboard_logs") {
    return "from-slate-500/15 to-zinc-500/10 text-slate-700 dark:text-slate-300";
  }
  return "from-[#13538A]/12 to-teal-500/5 text-[#13538A] dark:text-indigo-300";
}

export default function OrgFeaturesPanel({
  catalog,
  value,
  onChange,
  disabled = false,
  packageDefaults = [],
  isCustom = false,
}: Props) {
  const selected = useMemo(() => new Set(value), [value]);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      catalog.map((g, idx) => [g.id, idx === 0 || g.id === "loan_categories"]),
    ),
  );

  const q = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!q) return catalog;
    return catalog
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q) ||
            (item.description || "").toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [catalog, q]);

  const allKeys = useMemo(
    () => catalog.flatMap((g) => g.items.map((i) => i.key)),
    [catalog],
  );

  const catalogKeySet = useMemo(() => new Set(allKeys), [allKeys]);

  // Only count keys that still exist in the catalog (legacy/orphan keys can linger in saved overrides).
  const enabledCount = useMemo(
    () => value.filter((key) => catalogKeySet.has(key)).length,
    [value, catalogKeySet],
  );

  const pct =
    allKeys.length > 0
      ? Math.min(100, Math.round((enabledCount / allKeys.length) * 100))
      : 0;

  const toggle = (key: string) => {
    if (disabled) return;
    if (selected.has(key)) {
      onChange(value.filter((k) => k !== key));
      return;
    }
    onChange([...value, key]);
  };

  const setGroup = (groupId: string, enabled: boolean) => {
    if (disabled) return;
    const group = catalog.find((g) => g.id === groupId);
    if (!group) return;
    const keys = group.items.map((i) => i.key);
    if (enabled) {
      onChange([...new Set([...value, ...keys])]);
      return;
    }
    onChange(value.filter((k) => !keys.includes(k)));
  };

  const selectAll = () => onChange([...allKeys]);
  const clearAll = () => onChange([]);
  const resetToPackage = () => onChange([...packageDefaults]);
  const expandAll = () =>
    setOpenGroups(Object.fromEntries(catalog.map((g) => [g.id, true])));
  const collapseAll = () =>
    setOpenGroups(Object.fromEntries(catalog.map((g) => [g.id, false])));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-[#13538A] via-[#1763a3] to-[#18B6B4] px-5 py-5 text-white sm:px-6 dark:border-slate-800">
        <div
          className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <FiShield size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Broker Permissions</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    isCustom
                      ? "bg-amber-300/25 text-amber-50 ring-1 ring-amber-200/40"
                      : "bg-white/15 text-white ring-1 ring-white/25"
                  }`}
                >
                  {isCustom ? "Custom override" : "Package defaults"}
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Features, loan categories, and loan types available to this broker
                and their loan officers / co-brokers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
            <div
              className="relative flex h-14 w-14 items-center justify-center"
              aria-hidden
            >
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${pct} ${100 - pct}`}
                />
              </svg>
              <span className="absolute text-xs font-bold">{pct}%</span>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none">
                {enabledCount}
                <span className="text-base font-medium text-white/70">
                  /{allKeys.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-white/75">permissions enabled</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features, categories, or loan types..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-10 text-sm outline-none transition focus:border-[#18B6B4]/50 focus:bg-white focus:ring-4 focus:ring-[#18B6B4]/15 dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={selectAll}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={clearAll}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Clear
          </button>
          {packageDefaults.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={resetToPackage}
              className="rounded-xl border border-[#13538A]/25 bg-[#13538A]/8 px-3 py-2 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/15 disabled:opacity-50 dark:text-indigo-300"
            >
              Reset to package
            </button>
          )}
          <button
            type="button"
            onClick={expandAll}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Expand
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Collapse
          </button>
        </div>
      </div>

      <div className="space-y-2.5 p-4 sm:p-5">
        {filteredCatalog.map((group) => {
          const groupKeys = group.items.map((i) => i.key);
          const enabledCount = groupKeys.filter((k) => selected.has(k)).length;
          const allOn = enabledCount === groupKeys.length && groupKeys.length > 0;
          const open = Boolean(q) || openGroups[group.id] === true;
          const Icon = groupIcon(group.id);
          const accent = groupAccent(group.id);
          const groupPct =
            groupKeys.length > 0
              ? Math.round((enabledCount / groupKeys.length) * 100)
              : 0;

          return (
            <div
              key={group.id}
              className={`overflow-hidden rounded-2xl border transition ${
                allOn
                  ? "border-[#13538A]/25 bg-[#13538A]/[0.03] dark:border-indigo-500/30 dark:bg-indigo-500/[0.06]"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40"
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !open }))
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {group.title}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {enabledCount}/{groupKeys.length}
                      </span>
                    </span>
                    {group.description ? (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {group.description}
                      </span>
                    ) : null}
                    <span className="mt-2 block h-1 max-w-[10rem] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#13538A] to-[#18B6B4] transition-all"
                        style={{ width: `${groupPct}%` }}
                      />
                    </span>
                  </span>
                  <FiChevronDown
                    className={`ml-auto shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                    size={16}
                  />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setGroup(group.id, !allOn)}
                  className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/10 disabled:opacity-50 dark:bg-slate-800 dark:text-indigo-300"
                >
                  {allOn ? "Clear" : "All"}
                </button>
              </div>

              {open && (
                <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 dark:border-slate-800">
                  {group.items.map((item) => {
                    const checked = selected.has(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`group flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${
                          checked
                            ? "border-[#13538A]/40 bg-gradient-to-br from-[#13538A]/8 to-[#18B6B4]/5 shadow-sm dark:border-indigo-500/40 dark:from-indigo-500/15 dark:to-teal-500/5"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                            checked
                              ? "border-[#13538A] bg-[#13538A] text-white shadow-sm shadow-[#13538A]/30"
                              : "border-slate-300 bg-white group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900"
                          }`}
                        >
                          {checked ? <FiCheck size={12} strokeWidth={3} /> : null}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(item.key)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item.label}
                          </span>
                          {!group.id.startsWith("loan_types_") && item.description ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCatalog.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No features match your search
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-2 text-sm font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
