import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  text: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  defaultSelected?: string[];
  value?: string[];
  onChange?: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  /** Show Select all / Clear in the dropdown. Default true. */
  enableSelectAll?: boolean;
  /** Show search when there are enough options. Default true. */
  enableSearch?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  defaultSelected = [],
  value,
  onChange,
  disabled = false,
  placeholder = "Select options",
  loading = false,
  enableSelectAll = true,
  enableSearch = true,
}) => {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] =
    useState<string[]>(defaultSelected);
  const selectedOptions = isControlled ? value : internalSelected;
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.text.toLowerCase().includes(q));
  }, [options, search]);

  const allVisibleSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => selectedOptions.includes(opt.value));
  const someVisibleSelected = filteredOptions.some((opt) =>
    selectedOptions.includes(opt.value),
  );

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuMaxHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuMaxHeight && rect.top > spaceBelow;
    setMenuPos({
      top: openUpward ? Math.max(8, rect.top - menuMaxHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, options.length, filteredOptions.length, selectedOptions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest("[data-multiselect-menu='true']")
      ) {
        return;
      }
      setIsOpen(false);
      setSearch("");
      setFocusedIndex(-1);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && enableSearch) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, enableSearch]);

  const updateSelection = (newSelected: string[]) => {
    if (!isControlled) setInternalSelected(newSelected);
    onChange?.(newSelected);
  };

  const toggleDropdown = () => {
    if (!disabled && !loading) {
      setIsOpen((prev) => {
        if (prev) setSearch("");
        return !prev;
      });
      setFocusedIndex(-1);
    }
  };

  const handleSelect = (optionValue: string) => {
    const newSelected = selectedOptions.includes(optionValue)
      ? selectedOptions.filter((v) => v !== optionValue)
      : [...selectedOptions, optionValue];
    updateSelection(newSelected);
  };

  const removeOption = (optionValue: string) => {
    updateSelection(selectedOptions.filter((v) => v !== optionValue));
  };

  const selectAllVisible = () => {
    const next = new Set(selectedOptions);
    filteredOptions.forEach((opt) => next.add(opt.value));
    updateSelection(Array.from(next));
  };

  const clearAllVisible = () => {
    const visible = new Set(filteredOptions.map((opt) => opt.value));
    updateSelection(selectedOptions.filter((id) => !visible.has(id)));
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) clearAllVisible();
    else selectAllVisible();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearch("");
      return;
    }
    if (e.target === searchRef.current) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(0);
      }
      return;
    }

    e.preventDefault();
    switch (e.key) {
      case "Enter":
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      case "ArrowDown":
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0,
          );
        }
        break;
      case "ArrowUp":
        if (isOpen) {
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1,
          );
        }
        break;
    }
  };

  const showSearch = enableSearch && options.length >= 4;
  const labelId = `${label.replace(/\s+/g, "-").toLowerCase()}-label`;

  const dropdownMenu =
    isOpen &&
    createPortal(
      <div
        data-multiselect-menu="true"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: 280,
        }}
        className="z-[100001] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
      >
        {showSearch ? (
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        ) : null}

        {enableSelectAll && options.length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={filteredOptions.length === 0}
              className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-sky-300"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  allVisibleSelected
                    ? "border-[#13538A] bg-[#13538A] text-white"
                    : someVisibleSelected
                      ? "border-[#13538A] bg-[#13538A]/20"
                      : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                }`}
                aria-hidden
              >
                {allVisibleSelected ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5.2L3.8 7.5L8.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : someVisibleSelected ? (
                  <span className="h-0.5 w-2 rounded bg-[#13538A]" />
                ) : null}
              </span>
              {allVisibleSelected ? "Clear all" : "Select all"}
              {search.trim() ? " (filtered)" : ""}
            </button>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {selectedOptions.length} of {options.length} selected
            </span>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {loading
                ? "Loading..."
                : search.trim()
                  ? "No matches found"
                  : "No options available"}
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = selectedOptions.includes(option.value);
              const isFocused = index === focusedIndex;

              return (
                <div
                  key={option.value}
                  className={`w-full cursor-pointer border-b border-slate-100 last:border-b-0 dark:border-slate-800 ${
                    isFocused || isSelected
                      ? "bg-[#13538A]/8 dark:bg-sky-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  }`}
                  onClick={() => handleSelect(option.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex w-full items-center gap-3 px-3 py-2.5">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                      }`}
                      aria-hidden
                    >
                      {isSelected ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M1.5 5.2L3.8 7.5L8.5 2.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                      {option.text}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="w-full" ref={containerRef}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          id={labelId}
        >
          {label}
        </label>
        {selectedOptions.length > 0 ? (
          <span className="rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-semibold text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
            {selectedOptions.length} selected
          </span>
        ) : null}
      </div>

      <div className="relative w-full">
        <div
          ref={triggerRef}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          className="w-full"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          aria-disabled={disabled || loading}
          tabIndex={disabled || loading ? -1 : 0}
        >
          <div
            className={`flex min-h-12 rounded-xl border border-slate-300 bg-white py-1.5 pl-3 pr-3 shadow-sm outline-hidden transition focus-within:border-[#13538A] focus-within:ring-2 focus-within:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-900 ${
              disabled || loading
                ? "cursor-not-allowed bg-slate-50 opacity-50 dark:bg-slate-800"
                : "cursor-pointer"
            }`}
          >
            <div className="flex max-h-28 flex-auto flex-wrap gap-1.5 overflow-y-auto py-0.5">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((selectedValue) => {
                  const text =
                    options.find((opt) => opt.value === selectedValue)?.text ||
                    selectedValue;
                  return (
                    <div
                      key={selectedValue}
                      className="group flex max-w-full items-center rounded-lg border border-[#13538A]/15 bg-[#13538A]/8 py-1 pl-2.5 pr-1.5 text-sm text-[#0e3d66] dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"
                    >
                      <span className="max-w-[14rem] truncate">{text}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!disabled && !loading) removeOption(selectedValue);
                        }}
                        disabled={disabled || loading}
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/70 hover:text-slate-800 disabled:cursor-not-allowed dark:hover:bg-slate-800"
                        aria-label={`Remove ${text}`}
                      >
                        <svg
                          className="fill-current"
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="pointer-events-none flex h-full w-full items-center p-1 pr-2 text-sm text-slate-400 dark:text-slate-500">
                  {loading ? "Loading..." : placeholder}
                </div>
              )}
            </div>
            <div className="flex w-7 items-center self-start py-1 pl-1 pr-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown();
                }}
                disabled={disabled || loading}
                className="h-5 w-5 cursor-pointer text-slate-600 outline-hidden focus:outline-hidden disabled:cursor-not-allowed dark:text-slate-400"
                aria-label={isOpen ? "Close options" : "Open options"}
              >
                <svg
                  className={`stroke-current transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.79175 7.39551L10.0001 12.6038L15.2084 7.39551"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {dropdownMenu}
    </div>
  );
};

export default MultiSelect;
