import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";
import type { PermissionGroup } from "./adminUserShared";

type Props = {
  groups: PermissionGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
};

function actionTone(action?: string) {
  switch ((action || "").toUpperCase()) {
    case "VIEW":
      return "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
    case "CREATE":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "UPDATE":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "DELETE":
      return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    case "MANAGE":
      return "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
    case "EXPORT":
    case "SEND":
    case "UPLOAD":
    case "SUBMIT":
      return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300";
  }
}

const AdminPermissionSelector: React.FC<Props> = ({
  groups,
  selected,
  onChange,
  disabled = false,
  loading = false,
}) => {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allKeys = useMemo(
    () => groups.flatMap((g) => g.permissions.map((p) => p.key)),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (p) =>
            p.key.toLowerCase().includes(q) ||
            p.label.toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q) ||
            group.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [groups, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleKey = (key: string) => {
    if (disabled) return;
    if (selectedSet.has(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const toggleGroup = (group: PermissionGroup) => {
    if (disabled) return;
    const keys = group.permissions.map((p) => p.key);
    const allSelected = keys.every((k) => selectedSet.has(k));
    if (allSelected) {
      onChange(selected.filter((k) => !keys.includes(k)));
    } else {
      onChange([...new Set([...selected, ...keys])]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onChange([...allKeys]);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      next[g.id || g.label] = false;
    });
    setCollapsed(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      next[g.id || g.label] = true;
    });
    setCollapsed(next);
  };

  const selectedModules = groups.filter((g) =>
    g.permissions.some((p) => selectedSet.has(p.key)),
  ).length;

  const allExpanded = filteredGroups.every(
    (g) => !collapsed[g.id || g.label],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#13538A]/10 px-2.5 py-1 text-xs font-semibold text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
            {selected.length} selected
          </span>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {selectedModules}/{groups.length} modules
          </span>
          <span className="hidden text-xs text-gray-400 sm:inline">
            · {allKeys.length} total
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            disabled={loading || filteredGroups.length === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {allExpanded ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            {allExpanded ? "Collapse" : "Expand"}
          </button>
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled || loading || allKeys.length === 0}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#13538A] hover:bg-[#13538A]/10 disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || loading || selected.length === 0}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-gray-100 px-3 py-2.5 dark:border-slate-700">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by module or permission…"
            disabled={disabled}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div>
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
                <div className="grid grid-cols-2 gap-2 pl-2">
                  <div className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-slate-800/60" />
                  <div className="h-10 animate-pulse rounded-lg bg-gray-50 dark:bg-slate-800/60" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
              No permissions found
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Try a different search term.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const groupId = group.id || group.label;
            const isCollapsed = Boolean(collapsed[groupId]);
            const keys = group.permissions.map((p) => p.key);
            const selectedInGroup = keys.filter((k) =>
              selectedSet.has(k),
            ).length;
            const allSelected =
              keys.length > 0 && selectedInGroup === keys.length;
            const someSelected = selectedInGroup > 0 && !allSelected;

            return (
              <div
                key={groupId}
                className="border-b border-gray-100 last:border-0 dark:border-slate-800"
              >
                <div className="sticky top-0 z-[1] flex items-center gap-2 bg-white/95 px-3 py-2.5 backdrop-blur dark:bg-slate-900/95">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [groupId]: !prev[groupId],
                      }))
                    }
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                    aria-label={isCollapsed ? "Expand module" : "Collapse module"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    disabled={disabled}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      allSelected
                        ? "border-[#13538A] bg-[#13538A] text-white"
                        : someSelected
                          ? "border-[#13538A] bg-[#13538A]/25 text-[#13538A]"
                          : "border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                    }`}
                    aria-label={`Select all in ${group.label}`}
                  >
                    {(allSelected || someSelected) && (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [groupId]: !prev[groupId],
                      }))
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {group.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          allSelected
                            ? "bg-[#13538A]/10 text-[#13538A]"
                            : selectedInGroup > 0
                              ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                              : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {selectedInGroup}/{keys.length}
                      </span>
                    </div>
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-1.5 px-3 pb-3 sm:grid-cols-2">
                    {group.permissions.map((perm) => {
                      const checked = selectedSet.has(perm.key);
                      const action = perm.action || perm.key.split("_")[0];
                      return (
                        <label
                          key={perm.key}
                          className={`group flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${
                            checked
                              ? "border-[#13538A]/35 bg-[#13538A]/5 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/10"
                              : "border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700"
                          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-[#13538A] focus:ring-[#13538A]"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleKey(perm.key)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium leading-tight text-gray-800 dark:text-slate-100">
                                {perm.label}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionTone(action)}`}
                              >
                                {action}
                              </span>
                            </span>
                            {perm.description ? (
                              <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-slate-400">
                                {perm.description}
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
          })
        )}
      </div>

      {/* Selected summary chips */}
      {selected.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Selected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((key) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => toggleKey(key)}
                className="inline-flex items-center gap-1 rounded-full border border-[#13538A]/20 bg-white px-2 py-0.5 text-[11px] font-medium text-[#13538A] hover:bg-[#13538A]/5 disabled:opacity-50 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300"
                title="Remove permission"
              >
                {key
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                <X className="h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPermissionSelector;
