import { useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import {
  PACKAGE_FEATURE_LIBRARY,
  PACKAGE_FEATURE_TEMPLATES,
  type PackageFeatureGroup,
  type PackageFeatureItem,
  groupsToSelectedIds,
  itemId,
  selectedIdsToGroups,
} from "../../data/packageFeatureLibrary";
import { filterControlClass } from "./SubscriptionUi";

type Props = {
  value: PackageFeatureGroup[];
  onChange: (groups: PackageFeatureGroup[]) => void;
  disabled?: boolean;
};

function FeatureCheckbox({
  checked,
  onToggle,
  label,
  sub,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sub?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
        checked
          ? "border-[#13538A]/40 bg-[#13538A]/[0.06] dark:border-indigo-500/40 dark:bg-indigo-500/10"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600"
      } ${sub ? "ml-6" : ""}`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition ${
          checked
            ? "border-[#13538A] bg-[#13538A] text-white dark:border-indigo-500 dark:bg-indigo-500"
            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-transparent"
        }`}
      >
        {checked ? <FiCheck size={10} strokeWidth={3} /> : null}
      </span>
      <span
        className={`min-w-0 text-sm leading-snug ${
          sub
            ? "text-slate-600 dark:text-slate-400"
            : "font-medium text-slate-800 dark:text-slate-100"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export default function PackageMarketingFeaturesEditor({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      PACKAGE_FEATURE_LIBRARY.map((g, i) => [g.heading || `section-${i}`, true]),
    ),
  );

  const selected = useMemo(() => groupsToSelectedIds(value), [value]);
  const q = search.trim().toLowerCase();

  const applySelected = (next: Set<string>) => {
    onChange(selectedIdsToGroups(PACKAGE_FEATURE_LIBRARY, next));
  };

  const toggleId = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applySelected(next);
  };

  const toggleParent = (item: Extract<PackageFeatureItem, { label: string }>) => {
    const pid = itemId(item);
    const childIds = (item.children || []).map((c) => `c:${item.label}::${c}`);
    const next = new Set(selected);
    const allOn = next.has(pid) && childIds.every((id) => next.has(id));
    if (allOn) {
      next.delete(pid);
      for (const id of childIds) next.delete(id);
    } else {
      next.add(pid);
      for (const id of childIds) next.add(id);
    }
    applySelected(next);
  };

  const applyTemplate = (code: keyof typeof PACKAGE_FEATURE_TEMPLATES) => {
    const tpl = PACKAGE_FEATURE_TEMPLATES[code];
    if (!tpl) return;
    onChange(tpl.groups.map((g) => ({ ...g, items: [...g.items] })));
  };

  const filteredLibrary = useMemo(() => {
    if (!q) return PACKAGE_FEATURE_LIBRARY;
    return PACKAGE_FEATURE_LIBRARY.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (typeof item === "string") return item.toLowerCase().includes(q);
        const labelMatch = item.label.toLowerCase().includes(q);
        const childMatch = item.children.some((c) => c.toLowerCase().includes(q));
        return labelMatch || childMatch;
      }),
    })).filter((s) => s.items.length > 0);
  }, [q]);

  const toggleSection = (itemIds: string[]) => {
    const allOn = itemIds.every((id) => selected.has(id));
    const next = new Set(selected);
    if (allOn) for (const id of itemIds) next.delete(id);
    else for (const id of itemIds) next.add(id);
    applySelected(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pricing page features
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {selected.size} selected — shown on Loan AI pricing cards
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PACKAGE_FEATURE_TEMPLATES) as Array<
            keyof typeof PACKAGE_FEATURE_TEMPLATES
          >).map((code) => (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => applyTemplate(code)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300"
            >
              {PACKAGE_FEATURE_TEMPLATES[code].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <FiSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search features…"
          className={`w-full py-2.5 pr-3 pl-9 ${filterControlClass}`}
        />
      </div>

      <div className="space-y-3">
        {filteredLibrary.map((section, idx) => {
          const sectionKey = section.heading || `section-${idx}`;
          const sectionIds = section.items.flatMap((item) => {
            if (typeof item === "string") return [itemId(item)];
            return [
              itemId(item),
              ...(item.children || []).map((c) => `c:${item.label}::${c}`),
            ];
          });
          const sectionSelected = sectionIds.filter((id) => selected.has(id)).length;
          const isOpen = openSections[sectionKey] !== false;

          return (
            <div
              key={sectionKey}
              className={`overflow-hidden rounded-2xl border ${
                section.variant === "highlight"
                  ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5"
                  : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((o) => ({ ...o, [sectionKey]: !isOpen }))
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FiChevronDown
                    className={`shrink-0 text-slate-400 transition ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                  <span className="truncate text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    {section.heading || "Features"}
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800">
                    {sectionSelected}/{sectionIds.length}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleSection(sectionIds)}
                  className="shrink-0 cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-[#13538A] hover:opacity-80 dark:text-indigo-300"
                >
                  {sectionIds.every((id) => selected.has(id)) ? "Clear" : "All"}
                </button>
              </div>

              {isOpen ? (
                <div className="space-y-1.5 p-3">
                  {section.items.map((item) => {
                    if (typeof item === "string") {
                      const id = itemId(item);
                      if (q && !item.toLowerCase().includes(q)) return null;
                      return (
                        <FeatureCheckbox
                          key={id}
                          checked={selected.has(id)}
                          onToggle={() => toggleId(id)}
                          label={item}
                          disabled={disabled}
                        />
                      );
                    }

                    const pid = itemId(item);
                    const parentChecked = selected.has(pid);
                    const visibleChildren = q
                      ? item.children.filter(
                          (c) =>
                            c.toLowerCase().includes(q) ||
                            item.label.toLowerCase().includes(q),
                        )
                      : item.children;

                    if (
                      q &&
                      !item.label.toLowerCase().includes(q) &&
                      visibleChildren.length === 0
                    ) {
                      return null;
                    }

                    return (
                      <div key={pid} className="space-y-1">
                        <FeatureCheckbox
                          checked={parentChecked}
                          onToggle={() => toggleParent(item)}
                          label={item.label}
                          disabled={disabled}
                        />
                        {visibleChildren.map((child) => {
                          const cid = `c:${item.label}::${child}`;
                          return (
                            <FeatureCheckbox
                              key={cid}
                              sub
                              checked={selected.has(cid)}
                              onToggle={() => toggleId(cid)}
                              label={child}
                              disabled={disabled}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}