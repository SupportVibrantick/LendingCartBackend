import { ChevronDown, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  LO_PERMISSION_CATEGORIES,
  LO_PERMISSION_SELECT_ALL_KEYS,
  LO_RADIO_PERMISSION_CATEGORIES,
  countGrantedLoPermissionUiSlots,
  getLoPermissionUiSlotTotal,
  groupPermissionItemsBySubgroup,
  normalizeLoanOfficerPermissions,
  type LoanOfficerPermissionItem,
} from "../../pages/UserManagement/loanOfficerShared";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  disabled?: boolean;
};

function PermissionCheckbox({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: LoanOfficerPermissionItem;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
        checked
          ? "border-[#13538A]/30 bg-[#13538A]/5 dark:border-[#13538A]/40 dark:bg-[#13538A]/10"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#13538A] focus:ring-[#13538A]/20"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
          {item.label}
        </span>
        {item.description ? (
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {item.description}
          </span>
        ) : null}
        <span className="mt-1 block text-[10px] uppercase tracking-wide text-gray-400">
          {item.key}
        </span>
      </span>
    </label>
  );
}

export default function LoanOfficerPermissionsPanel({
  value,
  onChange,
  error,
  disabled = false,
}: Props) {
  const granted = useMemo(
    () => new Set(normalizeLoanOfficerPermissions(value)),
    [value],
  );
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LO_PERMISSION_CATEGORIES.map((category) => [category.title, true])),
  );

  const totalSelectable = getLoPermissionUiSlotTotal();
  const grantedSlotCount = countGrantedLoPermissionUiSlots(value);

  const togglePermission = (key: string) => {
    if (disabled) return;
    if (granted.has(key)) {
      onChange(value.filter((item) => item !== key));
      return;
    }
    onChange(normalizeLoanOfficerPermissions([...value, key]));
  };

  const setRadioCategoryPermission = (categoryTitle: string, key: string | null) => {
    if (disabled) return;
    const radioKeys = LO_RADIO_PERMISSION_CATEGORIES[categoryTitle] || [];
    const withoutGroup = value.filter((item) => !radioKeys.includes(item));
    onChange(key ? normalizeLoanOfficerPermissions([...withoutGroup, key]) : withoutGroup);
  };

  const setCategoryPermissions = (categoryTitle: string, enabled: boolean) => {
    if (disabled) return;
    const category = LO_PERMISSION_CATEGORIES.find((item) => item.title === categoryTitle);
    if (!category) return;

    const radioKeys = LO_RADIO_PERMISSION_CATEGORIES[categoryTitle];
    if (radioKeys) {
      if (enabled) {
        const defaultKey = radioKeys.find((key) => key.startsWith("MANAGE_")) || radioKeys[0];
        setRadioCategoryPermission(categoryTitle, defaultKey);
      } else {
        setRadioCategoryPermission(categoryTitle, null);
      }
      return;
    }

    const keys = category.items.map((item) => item.key);
    if (enabled) {
      onChange(normalizeLoanOfficerPermissions([...value, ...keys]));
      return;
    }

    onChange(value.filter((key) => !keys.includes(key)));
  };

  const selectAll = () => {
    if (disabled) return;
    onChange([...LO_PERMISSION_SELECT_ALL_KEYS]);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const toggleCategory = (title: string) => {
    setOpenCategories((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const renderCheckboxItems = (items: LoanOfficerPermissionItem[]) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <PermissionCheckbox
          key={item.key}
          item={item}
          checked={granted.has(item.key)}
          disabled={disabled}
          onToggle={() => togglePermission(item.key)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#13538A]/15 bg-[#13538A]/5 px-4 py-3 dark:border-[#13538A]/25 dark:bg-[#13538A]/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#13538A]" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Permission Categories
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {grantedSlotCount} of {totalSelectable} permissions selected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={selectAll}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={clearAll}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {LO_PERMISSION_CATEGORIES.map((category) => {
          const radioKeys = LO_RADIO_PERMISSION_CATEGORIES[category.title];
          const isRadioCategory = Boolean(radioKeys?.length);
          const categoryKeys = category.items.map((item) => item.key);
          const subgroups = groupPermissionItemsBySubgroup(category.items);
          const hasSubgroups = subgroups.some((group) => group.label.length > 0);
          const radioSelection =
            radioKeys?.find((key) => granted.has(key)) || null;
          const selectedCount = isRadioCategory
            ? radioSelection
              ? 1
              : 0
            : categoryKeys.filter((key) => granted.has(key)).length;
          const allSelected = isRadioCategory
            ? Boolean(radioSelection)
            : selectedCount === categoryKeys.length;
          const isOpen = openCategories[category.title] ?? true;

          return (
            <div
              key={category.title}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.title)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition ${isOpen ? "rotate-180" : ""}`}
                  />
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {category.title}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {isRadioCategory
                      ? `${selectedCount}/1`
                      : `${selectedCount}/${categoryKeys.length}`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setCategoryPermissions(category.title, !allSelected)}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-[#13538A] hover:bg-[#13538A]/10 disabled:opacity-50"
                >
                  {allSelected ? "Clear" : isRadioCategory ? "Enable" : "Select all"}
                </button>
              </div>

              {isOpen && (
                <div className="space-y-2 p-3">
                  {isRadioCategory ? (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Choose one access level for {category.title.toLowerCase()}.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {category.items.map((item) => {
                          const checked = radioSelection === item.key;
                          return (
                            <label
                              key={item.key}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                                checked
                                  ? "border-[#13538A]/30 bg-[#13538A]/5 dark:border-[#13538A]/40 dark:bg-[#13538A]/10"
                                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              <input
                                type="radio"
                                name={`lo-radio-${category.title}`}
                                checked={checked}
                                disabled={disabled}
                                onChange={() =>
                                  setRadioCategoryPermission(category.title, item.key)
                                }
                                className="mt-0.5 h-4 w-4 border-gray-300 text-[#13538A] focus:ring-[#13538A]/20"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
                                  {item.label}
                                </span>
                                {item.description ? (
                                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                    {item.description}
                                  </span>
                                ) : null}
                                <span className="mt-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                  {item.key}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        disabled={disabled || !radioSelection}
                        onClick={() => setRadioCategoryPermission(category.title, null)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        No {category.title.toLowerCase()} access
                      </button>
                    </>
                  ) : hasSubgroups ? (
                    <div className="space-y-4">
                      {subgroups.map((group) => (
                        <div key={group.label || "default"} className="space-y-2">
                          {group.label ? (
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              {group.label}
                            </p>
                          ) : null}
                          {renderCheckboxItems(group.items)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderCheckboxItems(category.items)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
