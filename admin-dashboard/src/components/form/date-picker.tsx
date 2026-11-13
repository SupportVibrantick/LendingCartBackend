import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  /** Controlled value as YYYY-MM-DD (preferred for filters). */
  value?: string;
  /** Fires with YYYY-MM-DD, or "" when cleared. */
  onDateChange?: (value: string) => void;
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
  title?: string;
  /** Popup calendar (false) vs always-visible (true). Default true for form demos. */
  static?: boolean;
  /** Canada / USA display: MM/DD/YYYY */
  dateFormat?: string;
  minDate?: DateOption;
  maxDate?: DateOption;
  className?: string;
  inputClassName?: string;
  showIcon?: boolean;
};

function toYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DatePicker({
  id,
  mode,
  onChange,
  value,
  onDateChange,
  label,
  defaultDate,
  placeholder,
  title,
  static: staticCalendar = true,
  dateFormat = "m/d/Y",
  minDate,
  maxDate,
  className,
  inputClassName,
  showIcon = true,
}: PropsType) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  const onDateChangeRef = useRef(onDateChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onDateChangeRef.current = onDateChange;
  }, [onChange, onDateChange]);

  useEffect(() => {
    if (!inputRef.current) return;

    const instance = flatpickr(inputRef.current, {
      mode: mode || "single",
      static: staticCalendar,
      monthSelectorType: "static",
      dateFormat,
      allowInput: true,
      disableMobile: true,
      minDate,
      maxDate,
      defaultDate: value || defaultDate,
      onChange: (selectedDates, dateStr, instanceArg) => {
        const hook = onChangeRef.current;
        if (hook) {
          if (Array.isArray(hook)) {
            hook.forEach((fn) => fn(selectedDates, dateStr, instanceArg));
          } else {
            hook(selectedDates, dateStr, instanceArg);
          }
        }
        const next = selectedDates[0] ? toYmd(selectedDates[0]) : "";
        onDateChangeRef.current?.(next);
      },
    });

    fpRef.current = Array.isArray(instance) ? instance[0] : instance;

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
    // Re-init only when picker identity/config changes — value sync is separate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, staticCalendar, dateFormat]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    if (!value) {
      if (fp.selectedDates.length) fp.clear();
      return;
    }
    const current = fp.selectedDates[0] ? toYmd(fp.selectedDates[0]) : "";
    if (current !== value) {
      fp.setDate(value, false);
    }
  }, [value]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    fp.set("minDate", minDate ?? undefined);
    fp.set("maxDate", maxDate ?? undefined);
  }, [minDate, maxDate]);

  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          title={title}
          placeholder={placeholder}
          className={
            inputClassName ||
            "h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
          }
        />

        {showIcon ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            <CalenderIcon className="size-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
