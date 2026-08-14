import { useEffect, useId, useRef } from "react";
import flatpickr from "flatpickr";
import type { Instance } from "flatpickr/dist/types/instance";
import { Calendar } from "lucide-react";
import "flatpickr/dist/flatpickr.css";

type LoanDateFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  disablePastDates?: boolean;
  hasError?: boolean;
};

const BASE_INPUT_CLASS =
  "w-full px-4 py-1 pr-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm";

const ERROR_INPUT_CLASS =
  "border-red-500 bg-red-50 ring-1 ring-red-200 focus:border-red-500 focus:ring-red-200";

export default function LoanDateField({
  value = "",
  onChange,
  placeholder = "dd-mm-yyyy",
  className = "",
  id: idProp,
  disabled = false,
  disablePastDates = false,
  hasError = false,
}: LoanDateFieldProps) {
  const autoId = useId().replace(/:/g, "");
  const id = idProp || `loan-date-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<Instance | null>(null);
  const onChangeRef = useRef(onChange);
  const classNameRef = useRef(className);
  const hasErrorRef = useRef(hasError);
  onChangeRef.current = onChange;
  classNameRef.current = className;
  hasErrorRef.current = hasError;

  const applyAltInputStyles = (instance: Instance) => {
    if (!instance.altInput) return;
    instance.altInput.placeholder = placeholder;
    const errorClass = hasErrorRef.current ? ERROR_INPUT_CLASS : "";
    instance.altInput.className =
      `${BASE_INPUT_CLASS} ${errorClass} ${classNameRef.current}`.trim();
  };

  useEffect(() => {
    if (!inputRef.current) return;

    fpRef.current = flatpickr(inputRef.current, {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      allowInput: true,
      disableMobile: true,
      defaultDate: value || undefined,
      minDate: disablePastDates ? "today" : undefined,
      onChange: (_dates, dateStr) => {
        onChangeRef.current(dateStr || "");
      },
      onReady: (_dates, _dateStr, instance) => {
        applyAltInputStyles(instance);

        if (
          instance.calendarContainer.querySelector(".flatpickr-footer-actions")
        ) {
          return;
        }

        const footer = document.createElement("div");
        footer.className =
          "flatpickr-footer-actions flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-600 text-sm";

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Clear";
        clearBtn.className = "text-[#2C92D5] font-medium hover:underline";
        clearBtn.onclick = () => {
          instance.clear();
          onChangeRef.current("");
        };

        const todayBtn = document.createElement("button");
        todayBtn.type = "button";
        todayBtn.textContent = "Today";
        todayBtn.className = "text-[#2C92D5] font-medium hover:underline";
        todayBtn.onclick = () => {
          instance.setDate(new Date(), true);
        };

        footer.appendChild(clearBtn);
        footer.appendChild(todayBtn);
        instance.calendarContainer.appendChild(footer);
      },
    });

    applyAltInputStyles(fpRef.current);

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [id, placeholder, disablePastDates]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    applyAltInputStyles(fp);
  }, [className, placeholder, hasError]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;

    const next = value || "";
    const selected = fp.selectedDates[0];
    const selectedIso = selected ? flatpickr.formatDate(selected, "Y-m-d") : "";

    if (selectedIso !== next) {
      fp.setDate(next || "", false);
    }
  }, [value]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;

    fp.input.toggleAttribute("disabled", disabled);
    fp.altInput?.toggleAttribute("disabled", disabled);
  }, [disabled]);

  return (
    <div className="relative loan-date-field [&_.flatpickr-wrapper]:block [&_.flatpickr-wrapper]:w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        className="hidden"
      />
      <Calendar
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]"
      />
    </div>
  );
}
